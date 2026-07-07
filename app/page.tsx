"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Download, AlignCenter, AlignLeft } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import jsPDF from "jspdf"

export default function LabelPrinter() {
  const [returnAddress, setReturnAddress] = useState({
    line1: "John Doe",
    line2: "123 Main Street",
    line3: "Apt. 1B",
    line4: "Anytown, USA 12345",
  })
  const [address, setAddress] = useState({
    line1: "Jane Doe",
    line2: "456 Main Street",
    line3: "Apt. 2C",
    line4: "Anytown, USA 12345",
  })
  const [fontSize, setFontSize] = useState(18)
  const [lineHeight, setLineHeight] = useState(1.2)
  const [alignment, setAlignment] = useState<"center" | "left">("center")

  const generatePDF = () => {
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: [288, 432], // 4 inches x 6 inches at 72 DPI
    })

    const pageWidth = 432 // 6 inches
    const pageHeight = 288 // 4 inches

    const returnLines = [returnAddress.line1, returnAddress.line2, returnAddress.line3, returnAddress.line4].filter(
      (line) => line.trim(),
    )
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(10)
    const returnLineHeight = 10 * 1.3
    returnLines.forEach((line, index) => {
      pdf.text(line, 20, 24 + index * returnLineHeight)
    })

    // Main address in center
    pdf.setFontSize(fontSize)
    const centerX = pageWidth / 2
    const centerY = pageHeight / 2

    const mainLineHeight = fontSize * lineHeight
    const lines = [address.line1, address.line2, address.line3, address.line4].filter((line) => line.trim())
    const totalHeight = mainLineHeight * (lines.length - 1)
    const startY = centerY - totalHeight / 2

    lines.forEach((line, index) => {
      let x: number
      if (alignment === "center") {
        const textWidth = pdf.getTextWidth(line)
        x = centerX - textWidth / 2
      } else {
        x = 40 // Left margin
      }
      pdf.text(line, x, startY + index * mainLineHeight)
    })

    pdf.save("mailing-label-4x6.pdf")
  }

  return (
    <div className="min-h-screen bg-background p-8 flex items-center justify-center">
      <div className="w-full max-w-5xl flex gap-6 flex-col lg:flex-row">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-xl text-center">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-border rounded-lg bg-white aspect-[3/2] flex flex-col p-4 relative">
              {/* Return address - top left */}
              <div className="text-left">
                {[returnAddress.line1, returnAddress.line2, returnAddress.line3, returnAddress.line4]
                  .filter((line) => line.trim())
                  .map((line, index) => (
                    <div key={index} style={{ fontSize: "10px", lineHeight: 1.3 }} className="text-black">
                      {line}
                    </div>
                  ))}
              </div>
              {/* Main address */}
              <div className={`flex-1 flex items-center ${alignment === "center" ? "justify-center" : "justify-start pl-4"}`}>
                <div className={alignment === "center" ? "text-center" : "text-left"}>
                  {[address.line1, address.line2, address.line3, address.line4]
                    .filter((line) => line.trim())
                    .map((line, index) => (
                      <div key={index} style={{ fontSize: `${fontSize}px`, lineHeight }} className="text-black">
                        {line}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-xl text-center">4x6 Mailing Label Printer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Return Address</Label>
              <Input
                value={returnAddress.line1}
                onChange={(e) => setReturnAddress({ ...returnAddress, line1: e.target.value })}
                placeholder="Your Name"
              />
              <Input
                value={returnAddress.line2}
                onChange={(e) => setReturnAddress({ ...returnAddress, line2: e.target.value })}
                placeholder="Street Address"
              />
              <Input
                value={returnAddress.line3}
                onChange={(e) => setReturnAddress({ ...returnAddress, line3: e.target.value })}
                placeholder="Apt/Suite"
              />
              <Input
                value={returnAddress.line4}
                onChange={(e) => setReturnAddress({ ...returnAddress, line4: e.target.value })}
                placeholder="City, State ZIP"
              />
            </div>

            <div className="border-t pt-4 space-y-3">
              <Label className="text-sm font-semibold">Recipient Address</Label>
              <Input
                value={address.line1}
                onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                placeholder="Company Name"
              />
              <Input
                value={address.line2}
                onChange={(e) => setAddress({ ...address, line2: e.target.value })}
                placeholder="Attention"
              />
              <Input
                value={address.line3}
                onChange={(e) => setAddress({ ...address, line3: e.target.value })}
                placeholder="Street Address"
              />
              <Input
                value={address.line4}
                onChange={(e) => setAddress({ ...address, line4: e.target.value })}
                placeholder="City, State ZIP"
              />
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="space-y-2">
                <Label>Recipient Alignment</Label>
                <ToggleGroup
                  type="single"
                  value={alignment}
                  onValueChange={(value) => value && setAlignment(value as "center" | "left")}
                  className="justify-start"
                >
                  <ToggleGroupItem value="center" aria-label="Center align">
                    <AlignCenter className="h-4 w-4 mr-2" />
                    Center
                  </ToggleGroupItem>
                  <ToggleGroupItem value="left" aria-label="Left align">
                    <AlignLeft className="h-4 w-4 mr-2" />
                    Left
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Font Size</Label>
                  <span className="text-sm text-muted-foreground">{fontSize}px</span>
                </div>
                <Slider
                  min={10}
                  max={36}
                  step={1}
                  value={[fontSize]}
                  onValueChange={(value) => setFontSize(value[0])}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Line Height</Label>
                  <span className="text-sm text-muted-foreground">{lineHeight.toFixed(1)}</span>
                </div>
                <Slider
                  min={0.8}
                  max={2}
                  step={0.1}
                  value={[lineHeight]}
                  onValueChange={(value) => setLineHeight(value[0])}
                />
              </div>
            </div>

            <Button onClick={generatePDF} className="w-full" size="lg">
              <Download className="mr-2 h-4 w-4" />
              Download 4x6 PDF Label
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
