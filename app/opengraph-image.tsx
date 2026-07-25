import { ImageResponse } from "next/og";

export const alt = "Tarantula — A cloud for small software";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#faf9f4",
          color: "#171815",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 430,
            height: 430,
            borderRadius: "50%",
            right: -110,
            top: -190,
            background: "#c9f76f",
          }}
        />
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            padding: "48px 54px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#d95d39",
                color: "#fff",
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              t
            </div>
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1 }}>
              tarantula
            </span>
            <span
              style={{
                marginLeft: 3,
                padding: "5px 7px",
                border: "1px solid #c9c6ba",
                color: "#6e7067",
                fontSize: 10,
                letterSpacing: 1.5,
              }}
            >
              ALPHA
            </span>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "flex-end",
              gap: 55,
            }}
          >
            <div style={{ width: 640, display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  marginBottom: 24,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 2.2,
                }}
              >
                A CLOUD FOR SMALL SOFTWARE
              </span>
              <div
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 82,
                  lineHeight: 0.94,
                  letterSpacing: -4,
                }}
              >
                Built for five users, not five million.
              </div>
              <p
                style={{
                  width: 590,
                  margin: "26px 0 0",
                  color: "#4c4d47",
                  fontSize: 21,
                  lineHeight: 1.35,
                }}
              >
                Hosting, data, auth, workers, files, secrets, and durable agents
                in one small cloud.
              </p>
            </div>

            <div
              style={{
                width: 375,
                height: 310,
                display: "flex",
                flexDirection: "column",
                background: "#171815",
                color: "#faf9f4",
                boxShadow: "14px 14px 0 #d8d0ff",
              }}
            >
              <div
                style={{
                  height: 54,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 20px",
                  borderBottom: "1px solid #3d3e36",
                  fontSize: 11,
                  letterSpacing: 1.2,
                }}
              >
                <span>RENEWAL-BOARD</span>
                <span style={{ color: "#c9f76f" }}>● LIVE</span>
              </div>
              {[
                ["WEB", "Live"],
                ["DATABASE", "42 rows"],
                ["AUTH", "8 users"],
                ["AGENT", "1 awaiting approval"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 20px",
                    borderBottom: "1px solid #30312c",
                  }}
                >
                  <span
                    style={{ color: "#777970", fontSize: 10, letterSpacing: 1 }}
                  >
                    {label}
                  </span>
                  <strong style={{ fontSize: 15 }}>{value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
