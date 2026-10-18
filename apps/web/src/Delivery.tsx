import { FoodArt } from "./DeliveryFoodArt";
import { Metric, RefundResult, DeliveryAuth } from "./DeliverySupport";
import { money } from "./delivery-format";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bike,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Headphones,
  Leaf,
  LogOut,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
  X,
} from "lucide-react";
import { Dialog } from "@repo/ui/dialog";
import {
  deliveryCatalog,
  type DeliveryOrder,
  type DeliveryStore,
  type DeliverySession,
  type DeliveryStatus,
  type Me,
  type RefundReason,
} from "@relay/contracts";
import { api, post } from "./api";
import Auth from "./Auth";
import Chat from "./Chat";
import "./delivery.css";
const labels: Record<DeliveryStatus, string> = {
  placed: "Order received",
  preparing: "In the kitchen",
  out_for_delivery: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const phases: DeliveryStatus[] = [
  "placed",
  "preparing",
  "out_for_delivery",
  "delivered",
];
const concierge = {
  name: "Parcel & Plate concierge",
  greeting:
    "Good food deserves good support. Ask about our refund policy or request a person to help.",
  color: "#244c38",
};
type Member = { id: string; name: string; email: string; role: string };

export default function Delivery() {
  const storeId = window.location.pathname.split("/")[2];
  const [store, setStore] = useState<DeliveryStore | null>(null),
    [session, setSession] = useState<DeliverySession | null>(null),
    [me, setMe] = useState<Me | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [tab, setTab] = useState("menu"),
    [category, setCategory] = useState("All dishes"),
    [search, setSearch] = useState(""),
    [cart, setCart] = useState<Record<string, number>>({}),
    [cartOpen, setCartOpen] = useState(false),
    [orders, setOrders] = useState<DeliveryOrder[]>([]),
    [members, setMembers] = useState<Member[]>([]);
  const [address, setAddress] = useState(""),
    [instructions, setInstructions] = useState(""),
    [checkoutId, setCheckoutId] = useState(() => crypto.randomUUID()),
    [support, setSupport] = useState<{
      id: string;
      agent: boolean;
      order: number;
    } | null>(null),
    [refundOrder, setRefundOrder] = useState<DeliveryOrder | null>(null),
    [decision, setDecision] = useState<{
      order: DeliveryOrder;
      decision: "approved" | "rejected";
    } | null>(null),
    [authOpen, setAuthOpen] = useState(false);
  const path = `/delivery/stores/${storeId}`;
  const showError = useCallback((text: string) => setError(text), []);
  const refresh = useCallback(async () => {
    if (!storeId) return;
    const [s, o] = await Promise.all([
      api<DeliveryStore>(`/delivery/stores/${storeId}`),
      api<DeliveryOrder[]>(`/delivery/stores/${storeId}/orders`),
    ]);
    setStore(s);
    setOrders(o);
  }, [storeId]);
  const loadSession = useCallback(async () => {
    if (!storeId) return;
    const value = await api<DeliverySession>(`/delivery/stores/${storeId}/me`);
    setSession(value);
    setAuthOpen(false);
    if (value.role === "worker") setTab("dispatch");
  }, [storeId]);
  useEffect(() => {
    let alive = true;
    if (!storeId) {
      void api<Me>("/me")
        .then((v) => {
          if (alive) setMe(v);
        })
        .catch(() => {})
        .finally(() => {
          if (alive) setLoading(false);
        });
    } else {
      void api<DeliveryStore>(path)
        .then((v) => {
          if (alive) setStore(v);
        })
        .catch((e) => {
          if (alive) setError((e as Error).message);
        });
      void loadSession()
        .catch(() => {})
        .finally(() => {
          if (alive) setLoading(false);
        });
    }
    return () => {
      alive = false;
    };
  }, [storeId, path, loadSession]);
  useEffect(() => {
    if (!session) return;
    void refresh().catch((e) => showError((e as Error).message));
    const timer = setInterval(() => void refresh().catch(() => {}), 5000);
    return () => clearInterval(timer);
  }, [session, refresh, showError]);
  useEffect(() => {
    if (tab !== "team" || session?.role !== "admin") return;
    void api<Member[]>(path + "/members")
      .then(setMembers)
      .catch((e) => showError((e as Error).message));
  }, [tab, path, session?.role, showError]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function launch(organizationId: string) {
    await run(async () => {
      const s = await post<DeliveryStore>("/delivery/setup", {
        organizationId,
      });
      window.location.href = "/delivery/" + s.id;
    });
  }
  async function prepare() {
    await run(async () => {
      await post(path + "/policy");
      await post(path + "/samples");
      await refresh();
      setNotice(
        "Sample orders created. Your policy PDF is processing in Relay.",
      );
    });
  }
  function add(id: string, delta = 1) {
    setCart((c) => ({
      ...c,
      [id]: Math.max(0, Math.min(10, (c[id] ?? 0) + delta)),
    }));
  }
  const count = Object.values(cart).reduce((a, b) => a + b, 0),
    subtotal = deliveryCatalog.reduce(
      (sum, p) => sum + p.price * (cart[p.id] ?? 0),
      0,
    );
  async function checkout() {
    if (!session) {
      setAuthOpen(true);
      return;
    }
    await run(async () => {
      await post(path + "/orders", {
        requestId: checkoutId,
        items: deliveryCatalog
          .filter((p) => cart[p.id])
          .map((p) => ({ productId: p.id, quantity: cart[p.id] })),
        address,
        instructions,
      });
      setCart({});
      setCheckoutId(crypto.randomUUID());
      setCartOpen(false);
      setTab("orders");
      await refresh();
      setNotice("Order placed. Follow its journey here.");
    });
  }
  async function openSupport(order: DeliveryOrder, agent = false) {
    await run(async () => {
      const chat = agent
        ? { id: order.conversation_id! }
        : await post<{ id: string }>(path + `/orders/${order.id}/support`);
      if (!chat.id)
        throw new Error(
          "The customer has not opened a support conversation yet.",
        );
      setSupport({ id: chat.id, agent, order: order.number });
    });
  }
  async function changeStatus(order: DeliveryOrder, status: DeliveryStatus) {
    await run(async () => {
      await post(path + `/orders/${order.id}/status`, { status });
      await refresh();
      setNotice("Order updated.");
    });
  }
  if (loading)
    return (
      <div className="delivery-loading">
        <Leaf />
        <p>Something good is on its way.</p>
      </div>
    );
  if (!storeId) {
    if (!me)
      return (
        <>
          <div className="delivery-return">
            <a href="/">← Relay workspace</a>
            <span>
              Sign in or create a workspace to launch your delivery demo.
            </span>
          </div>
          <Auth onSuccess={async () => setMe(await api<Me>("/me"))} />
        </>
      );
    return (
      <div className="delivery-app launch-page">
        <a className="delivery-brand" href="/">
          <span>
            <Leaf />
          </span>
          parcel & plate<i>by Relay</i>
        </a>
        <div className="launch-grid">
          <div>
            <span className="delivery-eyebrow">THE CONNECTED SUPPORT DEMO</span>
            <h1>
              A little delivery.
              <br />A lot of possibility.
            </h1>
            <p>
              Meet the delivery experience powered by your support platform.
              Real orders, a policy-trained assistant, and a human when it
              matters.
            </p>
            <div className="launch-features">
              <span>
                <Package /> Customer storefront
              </span>
              <span>
                <Bike /> Worker dispatch
              </span>
              <span>
                <ShieldCheck /> Refund review
              </span>
            </div>
            <h3>Choose your Relay workspace</h3>
            {me.organizations
              .filter((o) => ["OWNER", "ADMIN"].includes(o.role))
              .map((o) => (
                <button
                  className="d-button d-primary"
                  key={o.id}
                  disabled={busy}
                  onClick={() => void launch(o.id)}
                >
                  Launch for {o.name}
                  <ArrowRight size={18} />
                </button>
              ))}
            {!me.organizations.some((o) =>
              ["OWNER", "ADMIN"].includes(o.role),
            ) && (
              <p>
                A Relay owner or admin can create a delivery demo. Ask your
                workspace owner for its link.
              </p>
            )}
            {error && (
              <p role="alert" className="d-error">
                {error}
              </p>
            )}
            <a className="d-text-link" href="/">
              Back to Relay <ArrowUpRight size={16} />
            </a>
          </div>
          <div className="launch-art">
            <FoodArt large />
            <span className="floating-label">
              <Sparkles size={16} /> Good support, delivered.
            </span>
          </div>
        </div>
      </div>
    );
  }
  if (!store)
    return (
      <div className="delivery-loading">
        <Package />
        <h2>{error || "Opening your delivery store…"}</h2>
        <a href="/delivery">Back to demo setup</a>
      </div>
    );
  const admin = session?.role === "admin",
    worker = session?.role === "worker";
  const tabs = worker
    ? [{ id: "dispatch", label: "My deliveries" }]
    : [
        { id: "menu", label: "Discover" },
        { id: "orders", label: "My orders" },
        ...(admin
          ? [
              { id: "dispatch", label: "Dispatch" },
              { id: "operations", label: "Admin" },
              { id: "team", label: "Team" },
            ]
          : []),
      ];
  const myOrders = orders.filter((o) => o.customer_id === session?.user.id),
    activeOrders = orders.filter(
      (o) => !["delivered", "cancelled"].includes(o.status),
    ),
    refunds = orders.filter((o) => o.refund),
    pending = refunds.filter((o) => o.refund?.status === "pending");
  return (
    <div className="delivery-app">
      <div className="delivery-announcement">
        <span>
          <Leaf size={13} /> A fresh take on everyday delivery.
        </span>
        <a href="/">
          Support powered by Relay <ArrowUpRight size={12} />
        </a>
      </div>
      <header className="delivery-header">
        <a className="delivery-brand" href={"/delivery/" + storeId}>
          <span>
            <Leaf />
          </span>
          parcel & plate<span className="brand-dot">.</span>
        </a>
        <nav aria-label="Delivery navigation">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === "operations" && pending.length > 0 && (
                <i>{pending.length}</i>
              )}
            </button>
          ))}
        </nav>
        <div className="delivery-header-actions">
          {session ? (
            <>
              <span className="d-user">
                <span>{session.user.name.slice(0, 1)}</span>
                <span>
                  {session.user.name.split(" ")[0]}
                  <small>{session.role}</small>
                </span>
              </span>
              <button
                className="d-icon"
                aria-label="Sign out of delivery"
                onClick={() =>
                  void run(async () => {
                    await post("/auth/logout");
                    setSession(null);
                    setOrders([]);
                    setTab("menu");
                    setSupport(null);
                  })
                }
              >
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <button className="d-button" onClick={() => setAuthOpen(true)}>
              Sign in
            </button>
          )}
          {!worker && (
            <button
              className="basket-toggle"
              onClick={() => setCartOpen(true)}
              aria-label={`Open basket, ${count} items`}
            >
              <ShoppingBag size={19} />
              <span>{count}</span>
            </button>
          )}
        </div>
      </header>
      <main className="delivery-main">
        {error && (
          <div className="d-error" role="alert">
            {error}
            <button
              className="d-icon"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="d-notice" role="status">
            <CheckCircle2 size={18} />
            {notice}
          </div>
        )}
        {admin && store.policy_status !== "ready" && (
          <div className="demo-setup">
            <div>
              <Sparkles />
              <span>
                <strong>Your delivery demo, connected to Relay.</strong>
                <small>
                  {store.policy_status
                    ? `Policy status: ${store.policy_status}. Processing runs in the background.`
                    : "Load sample orders and train your assistant on the refund-policy PDF."}
                </small>
              </span>
            </div>
            <button
              className="d-button"
              disabled={
                busy ||
                store.policy_status === "processing" ||
                store.policy_status === "queued"
              }
              onClick={() => void prepare()}
            >
              {busy ? "Preparing…" : "Prepare demo"}
              <ArrowRight size={15} />
            </button>
          </div>
        )}
        {tab === "menu" && (
          <>
            <section className="delivery-hero">
              <div className="delivery-hero-copy">
                <span className="delivery-eyebrow">
                  <span /> GOOD FOOD. RIGHT TO YOUR DOOR.
                </span>
                <h1>
                  Your daily dose
                  <br />
                  of <em>delicious.</em>
                </h1>
                <p>
                  Thoughtfully made bowls, feel-good bites, and little
                  pick-me-ups. Delivered with a little extra care.
                </p>
                <button
                  className="d-button d-primary"
                  onClick={() =>
                    document
                      .getElementById("delivery-menu")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Find your feel-good food <ArrowRight size={18} />
                </button>
                <div className="hero-details">
                  <span>
                    <Clock size={16} /> 35-minute delivery target
                  </span>
                  <span>
                    <Leaf size={16} /> Made with care
                  </span>
                </div>
              </div>
              <div className="delivery-hero-art">
                <div className="hero-orbit" />
                <FoodArt large />
                <span className="hero-sticker">
                  FRESH
                  <br />
                  <b>feels good.</b>
                  <Leaf size={20} />
                </span>
                <div className="floating-label">
                  <span className="mini-avatar">
                    <Bike size={19} />
                  </span>
                  <div>
                    <strong>From our kitchen to yours</strong>
                    <small>Follow every step of your order</small>
                  </div>
                  <CheckCircle2 size={17} />
                </div>
              </div>
            </section>
            <section className="delivery-values">
              <span>
                <Leaf /> Fresh ingredients, happy plates
              </span>
              <span>
                <Truck /> A journey you can follow
              </span>
              <span>
                <Headphones /> Good people, here to help
              </span>
            </section>
            <section id="delivery-menu" className="menu-section">
              <div className="d-section-heading">
                <div>
                  <span className="delivery-eyebrow">THE GOOD STUFF</span>
                  <h2>What sounds good today?</h2>
                </div>
                <label className="d-search">
                  <Search size={17} />
                  <input
                    aria-label="Search menu"
                    placeholder="Find your next favorite"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              <div className="category-tabs">
                {[
                  "All dishes",
                  "Bowls",
                  "Seasonal",
                  "Comfort",
                  "Drinks",
                  "Treats",
                ].map((c) => (
                  <button
                    className={category === c ? "active" : ""}
                    key={c}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="food-grid">
                {deliveryCatalog
                  .filter(
                    (p) =>
                      (category === "All dishes" || p.category === category) &&
                      (p.name + " " + p.description)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  )
                  .map((p) => (
                    <article className="food-card" key={p.id}>
                      <div className={"food-picture " + p.art}>
                        <span className="food-tag">{p.tag}</span>
                        <FoodArt kind={p.art} />
                      </div>
                      <div className="food-info">
                        <span className="food-category">{p.category}</span>
                        <h3>{p.name}</h3>
                        <p>{p.description}</p>
                        <div>
                          <strong>{money(p.price)}</strong>
                          <button
                            className="food-add"
                            aria-label={`Add ${p.name}`}
                            onClick={() => {
                              add(p.id);
                              setNotice(p.name + " added to your basket.");
                            }}
                          >
                            <Plus size={17} />
                            {cart[p.id] ? cart[p.id] : "Add"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
              {!deliveryCatalog.some(
                (p) =>
                  (category === "All dishes" || p.category === category) &&
                  (p.name + " " + p.description)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              ) && (
                <div className="d-empty">
                  <Search />
                  <h3>No dishes found</h3>
                  <p>Try another search or category.</p>
                </div>
              )}
            </section>
            <section className="support-banner">
              <div className="support-badge">
                <Headphones size={30} />
              </div>
              <div>
                <span className="delivery-eyebrow">A LITTLE EXTRA CARE</span>
                <h2>Great food. Even better support.</h2>
                <p>
                  Policy-backed answers, clear refund checks, and a real person
                  when you need one.
                </p>
              </div>
              <button
                className="d-button"
                onClick={() => {
                  setTab("orders");
                  if (!session) setAuthOpen(true);
                }}
              >
                Get help with an order <ArrowUpRight size={18} />
              </button>
            </section>
          </>
        )}
        {tab === "orders" && (
          <>
            <div className="d-page-heading">
              <span className="delivery-eyebrow">
                FROM OUR KITCHEN TO YOUR DOOR
              </span>
              <h1>Your little deliveries.</h1>
              <p>Track your food, check a refund, or pick up a conversation.</p>
            </div>
            {!myOrders.length ? (
              <div className="d-empty">
                <ShoppingBag />
                <h2>Your next good meal is waiting.</h2>
                <p>
                  {session
                    ? "Your orders will appear here once you check out."
                    : "Sign in to see your orders and get support."}
                </p>
                <button
                  className="d-button d-primary"
                  onClick={() => (session ? setTab("menu") : setAuthOpen(true))}
                >
                  {session ? "Explore the menu" : "Sign in"}
                  <ArrowRight size={17} />
                </button>
              </div>
            ) : (
              <div className="orders-grid">
                {myOrders.map((order) => (
                  <article className="delivery-order" key={order.id}>
                    <div className="order-top">
                      <span>
                        <strong>Order #{order.number}</strong>
                        <small>
                          {new Date(order.created_at).toLocaleString()}
                        </small>
                      </span>
                      <span className={"d-status " + order.status}>
                        {labels[order.status]}
                      </span>
                    </div>
                    <div className="order-food">
                      <FoodArt kind={order.items[0]?.art} />
                      <div>
                        {order.items.map((i, n) => (
                          <p key={n}>
                            <b>{i.quantity} ×</b> {i.name}
                          </p>
                        ))}
                        <strong>{money(order.total_cents)}</strong>
                        <small>
                          Includes {money(order.delivery_cents)} delivery ·
                          Simulated payment
                        </small>
                      </div>
                    </div>
                    {order.status !== "cancelled" && (
                      <ol className="order-timeline">
                        {phases.map((phase, i) => (
                          <li
                            className={
                              phases.indexOf(order.status) >= i ? "done" : ""
                            }
                            key={phase}
                          >
                            <span>
                              {phases.indexOf(order.status) > i ? (
                                <Check size={12} />
                              ) : (
                                i + 1
                              )}
                            </span>
                            <small>{labels[phase]}</small>
                          </li>
                        ))}
                      </ol>
                    )}
                    <div className="order-address">
                      <MapPin size={16} />
                      <span>{order.address}</span>
                    </div>
                    {!["delivered", "cancelled"].includes(order.status) && (
                      <p className="delivery-eta">
                        <Clock size={15} /> Target arrival{" "}
                        {new Date(order.promised_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        . Status updates from your delivery team.
                      </p>
                    )}
                    {order.refund && <RefundResult order={order} />}
                    <div className="order-actions">
                      <button
                        className="d-button"
                        disabled={busy}
                        onClick={() => void openSupport(order)}
                      >
                        <Headphones size={16} />
                        Get support
                      </button>
                      <button
                        className="d-text-link"
                        disabled={busy || Boolean(order.refund)}
                        onClick={() => setRefundOrder(order)}
                      >
                        <Sparkles size={15} />
                        {order.refund
                          ? "Refund check recorded"
                          : "Check refund eligibility"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        {tab === "dispatch" && (
          <>
            <div className="d-page-heading">
              <span className="delivery-eyebrow">
                A SMOOTH JOURNEY, EVERY TIME
              </span>
              <h1>
                {worker ? "Your delivery desk." : "Keep the good food moving."}
              </h1>
              <p>
                {worker
                  ? "Pick up an unassigned order, then update each step. You can only change deliveries assigned to you."
                  : "Follow fulfilment from kitchen to doorstep. Workers claim an order when they start preparing it."}
              </p>
            </div>
            <div className="d-metrics">
              <Metric
                label="Active orders"
                value={activeOrders.length}
                icon={<Bike />}
              />
              <Metric
                label="On the way"
                value={
                  orders.filter((o) => o.status === "out_for_delivery").length
                }
                icon={<Truck />}
              />
              <Metric
                label="Delivered"
                value={orders.filter((o) => o.status === "delivered").length}
                icon={<CheckCircle2 />}
              />
            </div>
            <div className="dispatch-board">
              {phases.map((phase, index) => (
                <section className="dispatch-column" key={phase}>
                  <h3>
                    <span className={"phase-dot phase-" + index} />
                    {labels[phase]}
                    <b>{orders.filter((o) => o.status === phase).length}</b>
                  </h3>
                  {orders
                    .filter((o) => o.status === phase)
                    .map((order) => (
                      <article className="dispatch-card" key={order.id}>
                        <div>
                          <strong>#{order.number}</strong>
                          <small>
                            {new Date(order.promised_at).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </small>
                        </div>
                        <h4>{order.customer_name}</h4>
                        <p>
                          {order.items
                            .map((i) => `${i.quantity} × ${i.name}`)
                            .join(", ")}
                        </p>
                        <span className="dispatch-address">
                          <MapPin size={14} />
                          {order.address}
                        </span>
                        {order.instructions && (
                          <blockquote>{order.instructions}</blockquote>
                        )}
                        <small>
                          {order.worker_id
                            ? "Assigned to a worker"
                            : "Unassigned"}
                        </small>
                        {index < 3 && (
                          <button
                            className="d-button d-primary"
                            disabled={busy}
                            onClick={() =>
                              void changeStatus(order, phases[index + 1]!)
                            }
                          >
                            {index === 0
                              ? "Start preparing"
                              : index === 1
                                ? "Out for delivery"
                                : "Mark delivered"}
                            <ChevronRight size={15} />
                          </button>
                        )}
                        {admin && index < 2 && (
                          <button
                            className="d-text-link"
                            disabled={busy}
                            onClick={() =>
                              void changeStatus(order, "cancelled")
                            }
                          >
                            Cancel order
                          </button>
                        )}
                      </article>
                    ))}
                  {!orders.some((o) => o.status === phase) && (
                    <p className="column-empty">All clear here.</p>
                  )}
                </section>
              ))}
            </div>
          </>
        )}
        {tab === "operations" && admin && (
          <>
            <div className="d-page-heading">
              <span className="delivery-eyebrow">THE BIG PICTURE</span>
              <h1>Good service starts here.</h1>
              <p>
                Review policy checks, approve simulated refunds, and join
                customer conversations.
              </p>
            </div>
            <div className="d-metrics">
              <Metric
                label="Total orders"
                value={orders.length}
                icon={<Package />}
              />
              <Metric
                label="Awaiting review"
                value={pending.length}
                icon={<ShieldCheck />}
              />
              <Metric
                label="Simulated refunds"
                value={money(
                  refunds
                    .filter((o) => o.refund?.status === "approved")
                    .reduce((n, o) => n + o.refund!.amount_cents, 0),
                )}
                icon={<CheckCircle2 />}
              />
            </div>
            <section className="admin-policy">
              <div>
                <span className="delivery-eyebrow">
                  YOUR KNOWLEDGE CONNECTION
                </span>
                <h3>One policy. Every conversation.</h3>
                <p>
                  PDF ingestion: <b>{store.policy_status ?? "Not connected"}</b>{" "}
                  ·{" "}
                  {session?.aiEnabled
                    ? "AI explanations enabled"
                    : "Source previews enabled; no AI key configured"}
                </p>
              </div>
              <a
                className="d-button"
                href="/api/delivery/policy.pdf"
                target="_blank"
                rel="noreferrer"
              >
                <Download size={16} />
                View policy PDF
              </a>
              <button
                className="d-button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await post(path + "/policy");
                    await refresh();
                    setNotice(
                      "Policy upload checked. Existing documents are not duplicated.",
                    );
                  })
                }
              >
                Reconnect policy
              </button>
            </section>
            <div className="d-section-heading">
              <div>
                <h2>Refund review</h2>
                <p>Rules set the limits. You make the final decision.</p>
              </div>
              <span className="d-status preparing">
                {pending.length} pending
              </span>
            </div>
            {!refunds.length ? (
              <div className="d-empty compact">
                <ShieldCheck />
                <h3>No refund requests yet.</h3>
                <p>
                  Try a sample order from My orders to see the full review flow.
                </p>
              </div>
            ) : (
              <div className="refund-grid">
                {refunds.map((order) => (
                  <article className="refund-review" key={order.id}>
                    <div className="order-top">
                      <span>
                        <strong>Order #{order.number}</strong>
                        <small>{order.customer_name}</small>
                      </span>
                      <span className={"d-status " + order.refund!.status}>
                        {order.refund!.status}
                      </span>
                    </div>
                    <p className="customer-claim">“{order.refund!.details}”</p>
                    <RefundResult order={order} />
                    {order.refund!.status === "pending" && (
                      <div className="order-actions">
                        <button
                          className="d-button d-primary"
                          disabled={
                            busy ||
                            order.refund!.assessment === "ineligible" ||
                            !order.refund!.amount_cents
                          }
                          onClick={() =>
                            setDecision({ order, decision: "approved" })
                          }
                        >
                          Approve {money(order.refund!.amount_cents)}
                        </button>
                        <button
                          className="d-button"
                          disabled={busy}
                          onClick={() =>
                            setDecision({ order, decision: "rejected" })
                          }
                        >
                          Decline
                        </button>
                      </div>
                    )}
                    {order.conversation_id && (
                      <button
                        className="d-text-link"
                        onClick={() => void openSupport(order, true)}
                      >
                        <Headphones size={16} />
                        Open customer conversation
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
            <div className="d-section-heading">
              <div>
                <h2>Customer conversations</h2>
                <p>
                  Join the same Relay chat with the order context already
                  attached.
                </p>
              </div>
            </div>
            <div className="support-queue">
              {orders
                .filter((o) => o.conversation_id)
                .map((o) => (
                  <button key={o.id} onClick={() => void openSupport(o, true)}>
                    <span className="queue-icon">
                      <Headphones size={20} />
                    </span>
                    <span>
                      <strong>Order #{o.number}</strong>
                      <small>
                        {o.customer_name} · {labels[o.status]}
                      </small>
                    </span>
                    <ArrowUpRight size={18} />
                  </button>
                ))}
              {!orders.some((o) => o.conversation_id) && (
                <p className="column-empty">
                  Customer chats will appear here when someone opens support.
                </p>
              )}
            </div>
            <button
              className="d-text-link"
              disabled={busy}
              onClick={() => void prepare()}
            >
              Load sample orders (once per admin)
            </button>
          </>
        )}
        {tab === "team" && admin && (
          <>
            <div className="d-page-heading">
              <span className="delivery-eyebrow">PEOPLE MAKE IT HAPPEN</span>
              <h1>Your delivery team.</h1>
              <p>
                Customers sign up through your store link. Grant worker access
                to the people handling deliveries.
              </p>
            </div>
            <div className="team-layout">
              <section className="delivery-panel">
                <h2>Give someone a role</h2>
                <p>
                  Ask them to create an account at this store first. Admin
                  access follows Relay workspace permissions.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    void run(async () => {
                      await post(path + "/members", {
                        email: data.get("email"),
                        role: data.get("role"),
                      });
                      setMembers(await api<Member[]>(path + "/members"));
                      setNotice("Delivery role updated.");
                    });
                  }}
                >
                  <label>
                    Email address
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="teammate@example.com"
                    />
                  </label>
                  <label>
                    Delivery role
                    <select name="role">
                      <option value="worker">
                        Worker — prepare and deliver orders
                      </option>
                      <option value="customer">
                        Customer — shop and request support
                      </option>
                    </select>
                  </label>
                  <button className="d-button d-primary" disabled={busy}>
                    <Users size={17} />
                    Update role
                  </button>
                </form>
                <button
                  className="d-text-link"
                  onClick={() =>
                    void run(async () => {
                      await navigator.clipboard.writeText(
                        window.location.origin + "/delivery/" + storeId,
                      );
                      setNotice(
                        "Store link copied. Share it with customers or workers.",
                      );
                    })
                  }
                >
                  Copy store link <ArrowUpRight size={15} />
                </button>
              </section>
              <section className="delivery-panel">
                <h2>People in your store</h2>
                <div className="member-list">
                  {members.map((m) => (
                    <div key={m.id}>
                      <span className="member-avatar">
                        {m.name.slice(0, 1)}
                      </span>
                      <span>
                        <strong>{m.name}</strong>
                        <small>{m.email}</small>
                      </span>
                      <span className="d-status">{m.role}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </main>
      <footer className="delivery-footer">
        <div>
          <Leaf size={22} />
          <strong>parcel & plate.</strong>
          <span>Good food. Good people. Good days.</span>
        </div>
        <a href="/api/delivery/policy.pdf" target="_blank" rel="noreferrer">
          Delivery & refund policy <ArrowUpRight size={13} />
        </a>
        <span>Demo experience · No real payments</span>
        <a href="/">
          Powered by <b>relay.</b>
        </a>
      </footer>
      {cartOpen && (
        <Dialog
          title="A little bag of good things"
          onClose={() => setCartOpen(false)}
          className="delivery-dialog basket-dialog"
        >
          <p className="dialog-lead">Freshly made. Thoughtfully delivered.</p>
          {!count ? (
            <div className="d-empty compact">
              <ShoppingBag />
              <p>Your basket is waiting for something good.</p>
              <button
                className="d-button"
                onClick={() => {
                  setCartOpen(false);
                  setTab("menu");
                }}
              >
                Explore menu
              </button>
            </div>
          ) : (
            <>
              <div className="basket-items">
                {deliveryCatalog
                  .filter((p) => cart[p.id])
                  .map((p) => (
                    <div className="basket-item" key={p.id}>
                      <FoodArt kind={p.art} />
                      <div>
                        <strong>{p.name}</strong>
                        <small>{money(p.price)}</small>
                      </div>
                      <div className="quantity">
                        <button
                          aria-label={`Remove one ${p.name}`}
                          onClick={() => add(p.id, -1)}
                        >
                          <Minus size={13} />
                        </button>
                        <span>{cart[p.id]}</span>
                        <button
                          aria-label={`Add one ${p.name}`}
                          onClick={() => add(p.id)}
                          disabled={cart[p.id] === 10}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
              <div className="basket-total">
                <span>
                  Subtotal <b>{money(subtotal)}</b>
                </span>
                <span>
                  Delivery <b>{money(350)}</b>
                </span>
                <strong>
                  Total <b>{money(subtotal + 350)}</b>
                </strong>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void checkout();
                }}
              >
                <label>
                  Delivery address
                  <textarea
                    required
                    minLength={10}
                    maxLength={300}
                    placeholder="Street, building, and area"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </label>
                <label>
                  Delivery instructions <span>(optional)</span>
                  <input
                    maxLength={300}
                    placeholder="Anything your delivery person should know?"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                  />
                </label>
                <button className="d-button d-primary full" disabled={busy}>
                  {busy
                    ? "Placing your order…"
                    : session
                      ? "Place demo order"
                      : "Sign in to order"}
                  <ArrowRight size={17} />
                </button>
                <p className="demo-fineprint">
                  <ShieldCheck size={14} /> This is a demo. No card or payment
                  required.
                </p>
              </form>
            </>
          )}
          {error && (
            <p role="alert" className="d-error">
              {error}
            </p>
          )}
        </Dialog>
      )}
      {authOpen && (
        <DeliveryAuth
          path={path}
          onClose={() => setAuthOpen(false)}
          onSuccess={loadSession}
        />
      )}
      {support && (
        <Dialog
          title={`Support · Order #${support.order}`}
          onClose={() => setSupport(null)}
          className="delivery-dialog support-dialog"
        >
          <Chat
            key={support.id}
            bot={concierge}
            chatId={support.id}
            visitor={!support.agent}
            agent={support.agent}
            onNew={async () => {
              setNotice(
                "This chat is linked to your order. Open Get support again after resolution to start another.",
              );
              return support.id;
            }}
            onError={showError}
          />
          {error && (
            <p className="d-error" role="alert">
              {error}
            </p>
          )}
        </Dialog>
      )}
      {refundOrder && (
        <Dialog
          title={`Refund check · Order #${refundOrder.number}`}
          onClose={() => {
            if (!busy) setRefundOrder(null);
          }}
          className="delivery-dialog"
        >
          <p className="dialog-lead">
            We'll check the recorded order facts against our policy and retrieve
            a supporting explanation. A person approves every refund.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void run(async () => {
                await post(path + `/orders/${refundOrder.id}/refund`, {
                  reason: data.get("reason") as RefundReason,
                  details: data.get("details"),
                });
                await refresh();
                setRefundOrder(null);
                setNotice(
                  "Your policy check is ready. You can also discuss it with our team.",
                );
              });
            }}
          >
            <label>
              What happened?
              <select name="reason">
                <option value="late">My delivery was late</option>
                <option value="missing">An item was missing</option>
                <option value="damaged">An item was damaged</option>
                <option value="cancelled">My order was cancelled</option>
                <option value="other">Something else</option>
              </select>
            </label>
            <label>
              Tell us a little more
              <textarea
                name="details"
                required
                minLength={10}
                maxLength={1000}
                placeholder="Describe the issue so our team can help."
              />
            </label>
            <button className="d-button d-primary full" disabled={busy}>
              <Sparkles size={17} />
              {busy ? "Checking policy and order facts…" : "Check my refund"}
            </button>
          </form>
          {error && (
            <p role="alert" className="d-error">
              {error}
            </p>
          )}
        </Dialog>
      )}
      {decision && (
        <Dialog
          title={
            decision.decision === "approved"
              ? "Confirm simulated refund"
              : "Decline refund request"
          }
          onClose={() => setDecision(null)}
          className="delivery-dialog"
        >
          <p className="dialog-lead">
            Order #{decision.order.number} ·{" "}
            {money(decision.order.refund!.amount_cents)}. This records a final
            decision in the demo ledger; it does not transfer money.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void run(async () => {
                await post(
                  path + `/orders/${decision.order.id}/refund/decision`,
                  { decision: decision.decision, note: data.get("note") },
                );
                await refresh();
                setDecision(null);
                setNotice("Refund decision recorded.");
              });
            }}
          >
            <label>
              Review note
              <textarea
                name="note"
                required
                minLength={5}
                maxLength={500}
                placeholder="What did you verify? This note is visible to the customer."
              />
            </label>
            <button className="d-button d-primary full" disabled={busy}>
              Confirm{" "}
              {decision.decision === "approved" ? "approval" : "decline"}
            </button>
          </form>
          {error && (
            <p role="alert" className="d-error">
              {error}
            </p>
          )}
        </Dialog>
      )}
    </div>
  );
}
