import AppKit
import CoreText

let args = CommandLine.arguments
let fontURL = URL(fileURLWithPath: args[1]), out = URL(fileURLWithPath: args[2])
let size = CGFloat(Double(args[3]) ?? 1024), scale = CGFloat(Double(args[4]) ?? 1)
CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, nil)
let font = NSFont(name: "GentiumBookPlus-Bold", size: size * 1.1 * scale)!
let rgb = { (r: CGFloat, g: CGFloat, b: CGFloat) in NSColor(srgbRed: r / 255, green: g / 255, blue: b / 255, alpha: 1) }

let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(size), pixelsHigh: Int(size), bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
rgb(20, 25, 34).setFill()
NSRect(x: 0, y: 0, width: size, height: size).fill()

let text = NSMutableAttributedString()
let schwa: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: rgb(255, 128, 153)]
text.append(NSAttributedString(string: "ə", attributes: schwa))
let line = CTLineCreateWithAttributedString(text)
let bounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)
let ctx = NSGraphicsContext.current!.cgContext
ctx.textPosition = CGPoint(x: (size - bounds.width) / 2 - bounds.minX, y: (size - bounds.height) / 2 - bounds.minY)
CTLineDraw(line, ctx)
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: out)
