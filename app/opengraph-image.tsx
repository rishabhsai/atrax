import { ImageResponse } from "next/og";

export const alt = "Tarantula, a cloud for everyone";
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
          background: "#dd6b31",
          color: "#18130f",
          fontFamily: "monospace",
        }}
      >
        <div
          style={{
            width: "100%",
            padding: "48px 52px",
            display: "flex",
            flexDirection: "column",
            border: "18px solid #18130f",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 42,
                height: 42,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#18130f",
                color: "#dd6b31",
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              T
            </div>
            <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1.5 }}>
              tarantula
            </span>
            <span
              style={{
                padding: "5px 7px",
                border: "1px solid #18130f",
                fontFamily: "monospace",
                fontSize: 10,
              }}
            >
              V0
            </span>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 50,
            }}
          >
            <div style={{ maxWidth: 720, display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  marginBottom: 20,
                  fontFamily: "monospace",
                  fontSize: 13,
                  letterSpacing: 1.5,
                }}
              >
                SOFTWARE WITHOUT THE CLOUD OVERHEAD
              </span>
              <div
                style={{
                  fontSize: 78,
                  fontWeight: 900,
                  lineHeight: 0.88,
                  letterSpacing: -5,
                }}
              >
                A cloud for everyone.
              </div>
            </div>

            <div
              style={{
                width: 350,
                height: 280,
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                background: "#18130f",
                color: "#f4eadf",
                boxShadow: "13px 13px 0 #9c3d1d",
                fontFamily: "monospace",
                fontSize: 13,
                lineHeight: 1.65,
              }}
            >
              <span style={{ color: "#dd6b31" }}>$ tarantula deploy --json</span>
              <span style={{ marginTop: 22 }}>{`{`}</span>
              <span style={{ paddingLeft: 16 }}>&quot;schemaVersion&quot;: 1,</span>
              <span style={{ paddingLeft: 16 }}>&quot;status&quot;: &quot;deployed&quot;,</span>
              <span style={{ paddingLeft: 16 }}>&quot;url&quot;: &quot;https://...&quot;,</span>
              <span style={{ paddingLeft: 16 }}>&quot;resources&quot;: {`{`}</span>
              <span style={{ paddingLeft: 32 }}>&quot;tables&quot;: {`{`} &quot;id&quot;: &quot;1d6f...&quot; {`}`}</span>
              <span style={{ paddingLeft: 16 }}>{`}`}</span>
              <span>{`}`}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
