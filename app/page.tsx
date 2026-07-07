"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { Heart } from "lucide-react"
import jsPDF from "jspdf"

const MONO = "var(--font-jetbrains), monospace"
const SANS = "var(--font-instrument), system-ui, sans-serif"

type Address = { line1: string; line2: string; line3: string; line4: string }

const DEFAULTS: { ret: Address; addr: Address } = {
  ret: { line1: "John Doe", line2: "123 Main Street", line3: "Apt. 1B", line4: "Anytown, USA 12345" },
  addr: { line1: "Jane Doe", line2: "456 Main Street", line3: "Apt. 2C", line4: "Anytown, USA 12345" },
}

const SCOPED_CSS = `
input[type="range"] { -webkit-appearance: none; appearance: none; background: #d9e0e8; border-radius: 999px; }
input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 17px; height: 17px; border-radius: 50%; background: #1b3a6b; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(27,58,107,0.35); cursor: pointer; }
input[type="range"]::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: #1b3a6b; border: 3px solid #fff; cursor: pointer; }
.ls-reset:hover, .ls-swap:hover { border-color: #b8c2ce !important; color: #1b3a6b !important; }
.ls-input:focus { border-color: #1b3a6b !important; box-shadow: 0 0 0 3px rgba(27,58,107,0.08) !important; }
.ls-download:hover { background: #264f8f !important; }
.ls-credit:hover { text-decoration: underline !important; }
@media (max-width: 720px) {
  .ls-header { padding: 12px 16px !important; }
  .ls-main { padding: 14px !important; gap: 16px !important; flex-direction: column !important; }
  .ls-preview { min-width: 0 !important; flex: none !important; display: block !important; }
  .ls-aside { min-width: 0 !important; flex: none !important; }
  .ls-desk { padding: 22px 14px !important; }
  .ls-vdim { display: none !important; }
  .ls-scroll { overflow: visible !important; padding: 18px !important; }
  .ls-cols { flex-direction: column !important; gap: 18px !important; align-items: stretch !important; }
  .ls-sliders { flex-direction: column !important; gap: 14px !important; }
}
@media (prefers-reduced-motion: reduce) {
  .ls-root * { transition: none !important; }
}
`

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  border: "1px solid #d9e0e8",
  borderRadius: 9,
  background: "#f8fafc",
  fontSize: 14,
  fontFamily: "inherit",
  color: "#1b3a6b",
  outline: "none",
  transition: "border-color .15s, box-shadow .15s",
}

const cornerBase: CSSProperties = { position: "absolute", width: 11, height: 11 }

type LabelOpts = {
  ret: Address
  addr: Address
  includeReturn: boolean
  fontSize: number
  lineHeight: number
  alignment: "center" | "left"
  returnFontSize: number
  returnLineHeight: number
}

// Draw one label into the region (ox, oy) sized w × h (points).
function drawLabel(pdf: jsPDF, ox: number, oy: number, w: number, h: number, o: LabelOpts) {
  const rLines = o.includeReturn
    ? [o.ret.line1, o.ret.line2, o.ret.line3, o.ret.line4].filter((line) => line.trim())
    : []
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(o.returnFontSize)
  const returnLineHeight = o.returnFontSize * o.returnLineHeight
  rLines.forEach((line, index) => {
    pdf.text(line, ox + 20, oy + 24 + index * returnLineHeight)
  })

  pdf.setFontSize(o.fontSize)
  const centerX = ox + w / 2
  const centerY = oy + h / 2

  const mainLineHeight = o.fontSize * o.lineHeight
  const lines = [o.addr.line1, o.addr.line2, o.addr.line3, o.addr.line4].filter((line) => line.trim())
  const totalHeight = mainLineHeight * (lines.length - 1)
  const startY = centerY - totalHeight / 2

  lines.forEach((line, index) => {
    const x = o.alignment === "center" ? centerX - pdf.getTextWidth(line) / 2 : ox + 40
    pdf.text(line, x, startY + index * mainLineHeight)
  })
}

// Single source of truth for the exported file — used by both the live preview and Download.
function buildLabelPdf(opts: LabelOpts, twoUp: boolean): jsPDF {
  if (twoUp) {
    // Portrait 4 × 6 sheet (288 × 432 pt) = two 4 × 3 labels (288 × 216) stacked.
    // Rotated 90° from the native landscape so 4 in is each label's wide edge.
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: [288, 432] })
    drawLabel(pdf, 0, 0, 288, 216, opts)
    drawLabel(pdf, 0, 216, 288, 216, opts)
    // Dashed cut guide between the two labels.
    pdf.setLineDashPattern([4, 3], 0)
    pdf.setDrawColor(160)
    pdf.setLineWidth(0.5)
    pdf.line(0, 216, 288, 216)
    return pdf
  }

  // Native single label: landscape 4 × 6 sheet (432 × 288 pt), 6 in wide.
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [288, 432] })
  drawLabel(pdf, 0, 0, 432, 288, opts)
  return pdf
}

// First token of the recipient name, kebab-cased with accents/special chars stripped.
// "Jane Doe" -> "jane"; "Mary-Jane O'Neil" -> "mary-jane"; "José" -> "jose"; "" -> "".
function recipientFirstNameSlug(recipientName: string): string {
  const first = recipientName.trim().split(/\s+/)[0] ?? ""
  return first
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export default function LabelStudio() {
  const [ret, setRet] = useState<Address>({ ...DEFAULTS.ret })
  const [addr, setAddr] = useState<Address>({ ...DEFAULTS.addr })
  const [includeReturn, setIncludeReturn] = useState(true)
  const [fontSize, setFontSize] = useState(18)
  const [lineHeight, setLineHeight] = useState(1.2)
  const [alignment, setAlignment] = useState<"center" | "left">("center")
  const [returnFontSize, setReturnFontSize] = useState(10)
  const [returnLineHeight, setReturnLineHeight] = useState(1.3)
  const [twoUp, setTwoUp] = useState(false)

  const isCenter = alignment === "center"

  // Render the real exported PDF into a canvas so the preview is a pixel-accurate
  // WYSIWYG of the downloaded file — no browser PDF-viewer chrome. Debounced so
  // typing / dragging sliders doesn't thrash the renderer.
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null)
  const [sizeTick, setSizeTick] = useState(0)
  const [rendered, setRendered] = useState(false)

  // Re-render when the canvas box resizes (initial layout + responsive reflow).
  useEffect(() => {
    const el = canvasRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => setSizeTick((t) => t + 1))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      const canvas = canvasRef.current
      if (!canvas) return
      try {
        const pdfjs = await import("pdfjs-dist")
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

        const doc = buildLabelPdf(
          { ret, addr, includeReturn, fontSize, lineHeight, alignment, returnFontSize, returnLineHeight },
          twoUp,
        )
        const data = new Uint8Array(doc.output("arraybuffer") as ArrayBuffer)
        const loadingTask = pdfjs.getDocument({ data })
        const pdf = await loadingTask.promise
        const page = await pdf.getPage(1)
        if (cancelled) {
          loadingTask.destroy()
          return
        }

        const cssW = canvas.clientWidth || 480
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: (cssW * dpr) / base.width })
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        renderTaskRef.current?.cancel()
        const task = page.render({ canvasContext: ctx, viewport })
        renderTaskRef.current = task
        await task.promise
        loadingTask.destroy()
        if (!cancelled) setRendered(true)
      } catch (err) {
        if ((err as { name?: string })?.name !== "RenderingCancelledException") {
          console.error("PDF preview render failed", err)
        }
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [ret, addr, includeReturn, fontSize, lineHeight, alignment, returnFontSize, returnLineHeight, twoUp, sizeTick])

  const reset = () => {
    setRet({ ...DEFAULTS.ret })
    setAddr({ ...DEFAULTS.addr })
    setIncludeReturn(true)
    setFontSize(18)
    setLineHeight(1.2)
    setAlignment("center")
    setReturnFontSize(10)
    setReturnLineHeight(1.3)
    setTwoUp(false)
  }

  const swap = () => {
    setRet(addr)
    setAddr(ret)
  }

  const download = () => {
    const slug = recipientFirstNameSlug(addr.line1)
    const base = twoUp ? "mailing-labels-4x3" : "mailing-label-4x6"
    const filename = slug ? `${base}-${slug}.pdf` : `${base}.pdf`
    buildLabelPdf(
      { ret, addr, includeReturn, fontSize, lineHeight, alignment, returnFontSize, returnLineHeight },
      twoUp,
    ).save(filename)
  }

  const segBase: CSSProperties = {
    flex: 1,
    padding: "9px 0",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
    transition: "all .15s",
  }
  const segActive: CSSProperties = { background: "#1b3a6b", color: "#fff", boxShadow: "0 1px 3px rgba(27,58,107,0.2)" }
  const segInactive: CSSProperties = { background: "transparent", color: "#5b6675", boxShadow: "none" }

  return (
    <div
      className="ls-root"
      style={{
        minHeight: "100vh",
        background: "#eaeef3",
        fontFamily: SANS,
        color: "#1b3a6b",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />

      {/* Airmail ribbon — the postal signature */}
      <div
        aria-hidden="true"
        style={{
          height: 7,
          flexShrink: 0,
          backgroundImage:
            "repeating-linear-gradient(-45deg, #c8102e 0 10px, #ffffff 10px 17px, #1b3a6b 17px 27px, #ffffff 27px 34px)",
        }}
      />

      <header
        className="ls-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          padding: "16px 28px",
          borderBottom: "1px solid #d9e0e8",
          background: "#f6f8fb",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          {/* Postage-stamp mark: white perforated paper around a printed navy tile */}
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              background: "#fff",
              padding: 3,
              borderRadius: 4,
              border: "1.5px dotted #b7c2d4",
              boxShadow: "0 1px 2px rgba(27,58,107,0.18)",
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 2,
                background: "#1b3a6b",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: MONO,
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              L
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#7a8595",
              }}
            >
              Shipping Label Studio
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.1 }}>
              4 × 6 Mailing Label
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10.5,
              letterSpacing: "0.03em",
              color: "#7a8595",
              border: "1px solid #d9e0e8",
              borderRadius: 999,
              padding: "6px 13px",
            }}
          >
            {twoUp ? "2 × (4 × 3 in) · Portrait" : "4 × 6 in · Landscape"} · 72 DPI
          </span>
          <button
            type="button"
            className="ls-reset"
            onClick={reset}
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.04em",
              color: "#5b6675",
              background: "transparent",
              border: "1px solid #d9e0e8",
              borderRadius: 8,
              padding: "7px 13px",
              cursor: "pointer",
              transition: "all .15s",
            }}
          >
            Reset
          </button>
        </div>
      </header>

      <main
        className="ls-main"
        style={{
          flex: 1,
          display: "flex",
          flexWrap: "wrap",
          gap: 26,
          padding: 26,
          alignItems: "stretch",
        }}
      >
        <section className="ls-preview" style={{ flex: "1 1 460px", minWidth: 340, display: "flex", order: 2 }}>
          <div
            className="ls-desk"
            style={{
              flex: 1,
              border: "1px solid #d9e0e8",
              borderRadius: 18,
              backgroundColor: "#e7ecf2",
              backgroundImage: "radial-gradient(circle, rgba(27,58,107,0.055) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "44px 40px",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 16,
                left: 20,
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#94a1b2",
              }}
            >
              Live Preview
            </div>

            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "#94a1b2", marginBottom: 9 }}>
              ← {twoUp ? "4" : "6"} in →
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 11, width: "100%", maxWidth: 560 }}>
              <div
                className="ls-vdim"
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  color: "#94a1b2",
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                }}
              >
                ← {twoUp ? "6" : "4"} in →
              </div>

              <div
                style={{
                  flex: 1,
                  maxWidth: twoUp ? 296 : 560,
                  aspectRatio: twoUp ? "2 / 3" : "3 / 2",
                  background: "#ffffff",
                  borderRadius: 6,
                  boxShadow: "0 22px 44px -20px rgba(27,58,107,0.4), 0 2px 6px rgba(27,58,107,0.08)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <canvas
                  ref={canvasRef}
                  aria-label="Live preview of the exported PDF label"
                  role="img"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", background: "#ffffff" }}
                />
                {!rendered && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: MONO,
                      fontSize: 10,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "#c2ccd8",
                      background: "#ffffff",
                    }}
                  >
                    Rendering…
                  </div>
                )}

                <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}>
                  <div style={{ ...cornerBase, top: 8, left: 8, borderLeft: "1.5px solid #c8102e", borderTop: "1.5px solid #c8102e" }} />
                  <div style={{ ...cornerBase, top: 8, right: 8, borderRight: "1.5px solid #c8102e", borderTop: "1.5px solid #c8102e" }} />
                  <div style={{ ...cornerBase, bottom: 8, left: 8, borderLeft: "1.5px solid #c8102e", borderBottom: "1.5px solid #c8102e" }} />
                  <div style={{ ...cornerBase, bottom: 8, right: 8, borderRight: "1.5px solid #c8102e", borderBottom: "1.5px solid #c8102e" }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside
          className="ls-aside"
          style={{
            flex: "0 1 600px",
            minWidth: 480,
            display: "flex",
            flexDirection: "column",
            border: "1px solid #d9e0e8",
            borderRadius: 18,
            background: "#ffffff",
            overflow: "hidden",
            order: 1,
          }}
        >
          <div
            className="ls-scroll"
            style={{ flex: 1, overflow: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}
          >
            <div className="ls-cols" style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
              {/* Return address column */}
              <div className="ls-col" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 11 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 22 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7a8595" }}>
                    Return Address
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={includeReturn}
                    title="Include return address on label"
                    onClick={() => setIncludeReturn((v) => !v)}
                    style={{
                      width: 38,
                      height: 22,
                      borderRadius: 999,
                      border: "none",
                      cursor: "pointer",
                      padding: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: includeReturn ? "flex-end" : "flex-start",
                      background: includeReturn ? "#1b3a6b" : "#cbd3dd",
                      transition: "all .18s",
                    }}
                  >
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
                  </button>
                </div>
                {includeReturn ? (
                  <>
                    <input className="ls-input" value={ret.line1} onChange={(e) => setRet({ ...ret, line1: e.target.value })} placeholder="Your name" style={inputStyle} />
                    <input className="ls-input" value={ret.line2} onChange={(e) => setRet({ ...ret, line2: e.target.value })} placeholder="Street address" style={inputStyle} />
                    <input className="ls-input" value={ret.line3} onChange={(e) => setRet({ ...ret, line3: e.target.value })} placeholder="Apt / Suite" style={inputStyle} />
                    <input className="ls-input" value={ret.line4} onChange={(e) => setRet({ ...ret, line4: e.target.value })} placeholder="City, State ZIP" style={inputStyle} />
                  </>
                ) : (
                  <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "#94a1b2", background: "#f8fafc", border: "1px dashed #dbe2ea", borderRadius: 9, padding: "11px 13px" }}>
                    Hidden — won&rsquo;t print on this label. Toggle to add it back.
                  </div>
                )}
              </div>

              {/* Recipient address column */}
              <div className="ls-col" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 11 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 22 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7a8595" }}>
                    Recipient Address
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: "#b3bdca" }}>02</span>
                </div>
                <input className="ls-input" value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} placeholder="Recipient name" style={inputStyle} />
                <input className="ls-input" value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} placeholder="Street address" style={inputStyle} />
                <input className="ls-input" value={addr.line3} onChange={(e) => setAddr({ ...addr, line3: e.target.value })} placeholder="Apt / Suite" style={inputStyle} />
                <input className="ls-input" value={addr.line4} onChange={(e) => setAddr({ ...addr, line4: e.target.value })} placeholder="City, State ZIP" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: "#e6ebf1" }} />
              <button
                type="button"
                className="ls-swap"
                onClick={swap}
                title="Swap return & recipient"
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  color: "#5b6675",
                  background: "#f1f5f9",
                  border: "1px solid #d9e0e8",
                  borderRadius: 999,
                  padding: "6px 14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all .15s",
                }}
              >
                <span style={{ fontSize: 13 }}>⇅</span> Swap
              </button>
              <div style={{ flex: 1, height: 1, background: "#e6ebf1" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#7a8595",
                }}
              >
                Sheet Layout
              </span>
              <div style={{ display: "flex", gap: 4, padding: 4, background: "#eaeef3", borderRadius: 11, border: "1px solid #dde4ec" }}>
                <button type="button" onClick={() => setTwoUp(false)} style={{ ...segBase, ...(!twoUp ? segActive : segInactive) }}>
                  Single 4 × 6
                </button>
                <button type="button" onClick={() => setTwoUp(true)} style={{ ...segBase, ...(twoUp ? segActive : segInactive) }}>
                  Two 4 × 3
                </button>
              </div>
              <span style={{ fontSize: 12, lineHeight: 1.45, color: "#94a1b2" }}>
                {twoUp
                  ? "Two 4 × 3 labels stacked and rotated 90° so 4 in is the wide edge. Cut along the dashed guide."
                  : "One 4 × 6 label, 6 in wide (landscape)."}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#7a8595",
                }}
              >
                Typography
              </span>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#3d4756" }}>Recipient alignment</span>
                <div style={{ display: "flex", gap: 4, padding: 4, background: "#eaeef3", borderRadius: 11, border: "1px solid #dde4ec" }}>
                  <button type="button" onClick={() => setAlignment("center")} style={{ ...segBase, ...(isCenter ? segActive : segInactive) }}>
                    Centered
                  </button>
                  <button type="button" onClick={() => setAlignment("left")} style={{ ...segBase, ...(!isCenter ? segActive : segInactive) }}>
                    Left
                  </button>
                </div>
              </div>

              <div className="ls-sliders" style={{ display: "flex", gap: 22 }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#3d4756" }}>Recipient size</span>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: "#7a8595" }}>{fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={36}
                    step={1}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    aria-label="Recipient font size"
                    style={{ width: "100%", height: 5, cursor: "pointer" }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#3d4756" }}>Recipient line height</span>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: "#7a8595" }}>{lineHeight.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.8}
                    max={2}
                    step={0.1}
                    value={lineHeight}
                    onChange={(e) => setLineHeight(Number(e.target.value))}
                    aria-label="Recipient line height"
                    style={{ width: "100%", height: 5, cursor: "pointer" }}
                  />
                </div>
              </div>

              {includeReturn && (
                <div className="ls-sliders" style={{ display: "flex", gap: 22 }}>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#3d4756" }}>Return size</span>
                      <span style={{ fontFamily: MONO, fontSize: 12, color: "#7a8595" }}>{returnFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={6}
                      max={24}
                      step={1}
                      value={returnFontSize}
                      onChange={(e) => setReturnFontSize(Number(e.target.value))}
                      aria-label="Return address font size"
                      style={{ width: "100%", height: 5, cursor: "pointer" }}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#3d4756" }}>Return line height</span>
                      <span style={{ fontFamily: MONO, fontSize: 12, color: "#7a8595" }}>{returnLineHeight.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.8}
                      max={2}
                      step={0.1}
                      value={returnLineHeight}
                      onChange={(e) => setReturnLineHeight(Number(e.target.value))}
                      aria-label="Return address line height"
                      style={{ width: "100%", height: 5, cursor: "pointer" }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: "16px 24px", borderTop: "2px dashed #cdd7e4", background: "#f6f8fb" }}>
            <button
              type="button"
              className="ls-download"
              onClick={download}
              style={{
                width: "100%",
                padding: 14,
                border: "none",
                borderRadius: 12,
                background: "#1b3a6b",
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                transition: "background .15s",
              }}
            >
              <span style={{ fontFamily: MONO, fontWeight: 700 }}>↓</span> Download {twoUp ? "two 4 × 3" : "4 × 6"} PDF
            </button>
          </div>
        </aside>
      </main>

      <footer
        style={{
          padding: "14px 28px",
          borderTop: "1px solid #d9e0e8",
          background: "#f6f8fb",
          fontFamily: SANS,
          fontSize: 12.5,
          color: "#7a8595",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 5,
        }}
      >
        <span>Made with</span>
        <Heart size={13} fill="#c8102e" strokeWidth={0} aria-hidden="true" style={{ display: "block" }} />
        <span>
          by{" "}
          <a
            className="ls-credit"
            href="https://x.com/aeksco"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#1b3a6b", fontWeight: 600, textDecoration: "none" }}
          >
            @aeksco
          </a>
        </span>
      </footer>
    </div>
  )
}
