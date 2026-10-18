export function FoodArt({
  kind = "bowl",
  large = false,
}: {
  kind?: string;
  large?: boolean;
}) {
  const drink = kind === "drink",
    cookie = kind === "cookie",
    sandwich = kind === "sandwich";
  return (
    <svg
      viewBox="0 0 320 240"
      className={"food-art " + (large ? "large" : "")}
      role="img"
      aria-label={kind + " illustration"}
    >
      <ellipse
        cx="164"
        cy="202"
        rx="112"
        ry="19"
        fill="#20412a"
        opacity=".10"
      />
      {drink ? (
        <g>
          <path
            d="M110 54h100l-13 145q-37 16-74 0z"
            fill="#fdf8e7"
            stroke="#d8dac5"
            strokeWidth="3"
          />
          <path d="M117 92h86l-9 102q-32 12-65 0z" fill="#91ad68" />
          <path
            d="M119 97q40-15 81 0"
            fill="none"
            stroke="#dfe8bc"
            strokeWidth="14"
          />
          <path
            d="M169 121l14-94"
            stroke="#41633f"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <rect x="109" y="48" width="103" height="11" rx="5" fill="#e7e8d9" />
          <circle cx="157" cy="151" r="22" fill="#eaf0d6" />
          <path d="M146 155q25-30 25-5q-18 19-25 5" fill="#557647" />
        </g>
      ) : cookie ? (
        <g>
          <circle cx="160" cy="121" r="83" fill="#eed7aa" />
          <circle
            cx="160"
            cy="118"
            r="74"
            fill="#c59256"
            stroke="#dca66b"
            strokeWidth="8"
          />
          {[
            [130, 75],
            [189, 86],
            [117, 131],
            [167, 123],
            [193, 155],
            [149, 172],
            [155, 65],
            [213, 118],
            [133, 103],
          ].map(([x, y], i) => (
            <rect
              key={i}
              x={x}
              y={y}
              width={i % 2 ? 16 : 12}
              height={i % 2 ? 11 : 15}
              rx="3"
              fill="#65412e"
              transform={`rotate(${i * 25} ${x} ${y})`}
            />
          ))}
          <path
            d="M114 162q23 26 59 17"
            stroke="#e8b77e"
            strokeWidth="4"
            fill="none"
          />
        </g>
      ) : sandwich ? (
        <g>
          <path d="M68 139q92 40 184 0l-12 37q-80 42-160 0z" fill="#d69b55" />
          <path
            d="M72 131l34-15 26 18 33-16 23 17 30-20 30 15-13 22H88z"
            fill="#739456"
          />
          <path d="M80 122q80-40 160 0l-9 18q-70-22-140 0z" fill="#b57535" />
          <path d="M69 116q0-75 91-75t91 75q-92 28-182 0" fill="#e9b975" />
          <path
            d="M85 100q21-48 72-45"
            stroke="#f4ce91"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
          />
          {[110, 136, 161, 187, 213].map((x, i) => (
            <path
              key={x}
              d={`M${x} ${73 + (i % 2) * 13}l5-3`}
              stroke="#fff0c3"
              strokeWidth="4"
              strokeLinecap="round"
            />
          ))}
        </g>
      ) : (
        <g>
          <ellipse cx="160" cy="128" rx="113" ry="91" fill="#e5ddc5" />
          <ellipse cx="160" cy="119" rx="110" ry="88" fill="#fffdf4" />
          <ellipse cx="160" cy="119" rx="93" ry="72" fill="#b5c18c" />
          {Array.from({ length: 13 }, (_, i) => (
            <ellipse
              key={i}
              cx={97 + (i % 5) * 30}
              cy={76 + Math.floor(i / 5) * 30}
              rx="21"
              ry="15"
              transform={`rotate(${i * 33} ${97 + (i % 5) * 30} ${76 + Math.floor(i / 5) * 30})`}
              fill={["#627d43", "#87a05d", "#415f37"][i % 3]}
            />
          ))}
          {kind === "salmon" ? (
            <g transform="rotate(-20 164 115)">
              <rect
                x="125"
                y="65"
                width="79"
                height="104"
                rx="19"
                fill="#df9579"
              />
              {[85, 102, 120, 138, 155].map((y) => (
                <path
                  key={y}
                  d={`M131 ${y}q30-9 67 1`}
                  stroke="#f2c1a0"
                  strokeWidth="5"
                  fill="none"
                />
              ))}
            </g>
          ) : kind === "salad" ? (
            <g>
              <circle cx="157" cy="115" r="37" fill="#f6f1d9" />
              <path
                d="M134 107q20-30 43-1"
                stroke="#fffef6"
                strokeWidth="8"
                fill="none"
              />
              {[
                [-42, 15],
                [44, 10],
                [18, -42],
              ].map(([x, y], i) => (
                <circle
                  key={i}
                  cx={157 + x!}
                  cy={115 + y!}
                  r="19"
                  fill="#c96642"
                />
              ))}
            </g>
          ) : (
            <g transform="rotate(-28 157 120)">
              <ellipse cx="164" cy="116" rx="40" ry="57" fill="#365b38" />
              <ellipse cx="164" cy="116" rx="33" ry="49" fill="#bace79" />
              <ellipse cx="164" cy="116" rx="26" ry="40" fill="#dce5a0" />
              <circle cx="164" cy="128" r="20" fill="#94623c" />
              <circle cx="158" cy="121" r="7" fill="#ad7c4b" />
            </g>
          )}
          {[85, 102, 90, 110, 219, 229, 207].map((x, i) => (
            <circle
              key={i}
              cx={x}
              cy={115 + (i % 3) * 16}
              r="6"
              fill="#d9b969"
            />
          ))}
          <path
            d="M107 171q49 24 98-5"
            stroke="#f2e7c7"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      )}
      <path d="M253 48q33-12 25 16q-25 12-25-16" fill="#6a8753" />
      <path d="M258 49l18 14" stroke="#c7d9ae" strokeWidth="2" />
    </svg>
  );
}
