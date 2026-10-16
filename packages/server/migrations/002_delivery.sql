CREATE TABLE delivery_stores (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL UNIQUE REFERENCES organizations,
 bot_id uuid NOT NULL, name text NOT NULL DEFAULT 'Parcel & Plate', created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(bot_id,organization_id) REFERENCES bots(id,organization_id), UNIQUE(id,organization_id)
);
CREATE TABLE delivery_members (
 store_id uuid NOT NULL, organization_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES users,
 role text NOT NULL CHECK(role IN ('admin','worker','customer')),
 PRIMARY KEY(store_id,user_id), FOREIGN KEY(store_id,organization_id) REFERENCES delivery_stores(id,organization_id)
);
CREATE TABLE delivery_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), number bigint GENERATED ALWAYS AS IDENTITY,
 store_id uuid NOT NULL, organization_id uuid NOT NULL, customer_id uuid NOT NULL REFERENCES users, worker_id uuid REFERENCES users,
 request_id uuid NOT NULL, items jsonb NOT NULL, total_cents integer NOT NULL CHECK(total_cents>0), delivery_cents integer NOT NULL CHECK(delivery_cents>=0),
 address text NOT NULL, instructions text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'placed' CHECK(status IN ('placed','preparing','out_for_delivery','delivered','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(), promised_at timestamptz NOT NULL DEFAULT now()+interval '35 minutes', delivered_at timestamptz,
 conversation_id uuid, FOREIGN KEY(store_id,organization_id) REFERENCES delivery_stores(id,organization_id),
 FOREIGN KEY(conversation_id,organization_id) REFERENCES conversations(id,organization_id),
 UNIQUE(customer_id,store_id,request_id), UNIQUE(id,organization_id), FOREIGN KEY(store_id,customer_id) REFERENCES delivery_members(store_id,user_id),
 FOREIGN KEY(store_id,worker_id) REFERENCES delivery_members(store_id,user_id)
);
CREATE INDEX delivery_order_scope ON delivery_orders(store_id,created_at DESC);
CREATE TABLE delivery_refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL UNIQUE, organization_id uuid NOT NULL,
 reason text NOT NULL CHECK(reason IN ('missing','damaged','late','cancelled','other')), details text NOT NULL,
 assessment text NOT NULL CHECK(assessment IN ('eligible','ineligible','review')), explanation text NOT NULL,
 amount_cents integer NOT NULL CHECK(amount_cents>=0), policy_version text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 ai_content text NOT NULL DEFAULT '', ai_mode text NOT NULL DEFAULT 'fallback' CHECK(ai_mode IN ('ai','preview','fallback')), citations jsonb NOT NULL DEFAULT '[]',
 decided_by uuid REFERENCES users, decision_note text, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(order_id,organization_id) REFERENCES delivery_orders(id,organization_id)
);
