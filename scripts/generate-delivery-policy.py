"""Generate the versioned demo policy and a PNG for visual QA.
Requires reportlab and pymupdf. Run from the repository root.
"""
from pathlib import Path
import sys
local_tools = Path('.platform-logs/pdf-tools')
if local_tools.exists():
    sys.path.insert(0, str(local_tools.resolve()))
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
import pymupdf as fitz

out = Path('packages/server/assets/parcel-plate-refund-policy.pdf')
out.parent.mkdir(parents=True, exist_ok=True)
c = canvas.Canvas(str(out), pagesize=(595, 842))
c.setTitle('Parcel & Plate | Delivery and Refund Policy')
c.setAuthor('Parcel & Plate demo / Relay')

def text(x, y, value, size=11, color='#465249', font='Helvetica'):
    c.setFillColor(HexColor(color)); c.setFont(font, size); c.drawString(x, y, value)

def rule(y, number, title, lines):
    c.setFillColor(HexColor('#e8efdf')); c.roundRect(42, y-12, 36, 29, 8, fill=1, stroke=0)
    text(50, y-2, number, 11, '#284d36', 'Helvetica-Bold')
    text(92, y, title, 13, '#193d2b', 'Helvetica-Bold')
    for i, line in enumerate(lines): text(92, y-22-i*16, line, 10)

c.setFillColor(HexColor('#f8f7f2')); c.rect(0,0,595,842,fill=1,stroke=0)
c.setFillColor(HexColor('#183e2b')); c.rect(0,646,595,196,fill=1,stroke=0)
text(42,793,'PARCEL & PLATE',16,'#ecf0df','Helvetica-Bold')
text(42,755,'Good food. Fair resolutions.',25,'#ffffff','Helvetica-Bold')
text(42,725,'Delivery & refund policy',14,'#c9d7bd')
text(42,687,'DEMO POLICY  /  VERSION 2026-10-17',9,'#c9d7bd')
text(42,616,'Clear rules, with a person when you need one.',15,'#193d2b','Helvetica-Bold')
text(42,594,'This policy applies to simulated orders in the Parcel & Plate demo.',10)
rule(556,'R1','Cancelled orders',[
'A cancelled order qualifies for a full refund of the amount paid.',
'Only an administrator can cancel an order before dispatch.'])
rule(479,'R2','Missing or damaged items',[
'Report the issue within 24 hours of recorded delivery.',
'A teammate verifies the issue before approval. The full amount paid',
'is the maximum possible refund; a claim is not automatic approval.'])
rule(386,'R3','Late delivery',[
'If recorded delivery is at least 30 minutes after the promised time,',
'the delivery fee qualifies for a refund. Report it within 24 hours',
'of recorded delivery. The food subtotal is not refundable for lateness.'])
rule(293,'R4','Reporting window',[
'Requests after 24 hours do not qualify under the standard rules.',
'You can always request a person to discuss your circumstances.'])
rule(216,'R5','Human review and active orders',[
'Orders still in progress, disputed facts, and other concerns require',
'a teammate. AI explains the policy; it cannot move money or approve',
'payments. Every refund decision requires an administrator.'])
c.setStrokeColor(HexColor('#d7ddcf')); c.line(42,126,553,126)
text(42,103,'HOW TO GET HELP',9,'#193d2b','Helvetica-Bold')
text(42,85,'Open an order > Get support > Talk to our team. Your chat stays together.',10)
text(42,58,'Demo only: refunds are ledger entries. No payment processor is connected.',9)
text(42,32,'Parcel & Plate  /  Support powered by Relay',8)
text(528,32,'1 / 1',8)
c.save()
qa = Path('.platform-logs/pdf-preview'); qa.mkdir(parents=True, exist_ok=True)
doc = fitz.open(out)
assert len(doc)==1
page = doc[0]
for key in ['R1','R2','R3','R4','R5','24 hours','30 minutes']:
    assert key in page.get_text(), key
page.get_pixmap(matrix=fitz.Matrix(1.5,1.5)).save(str(qa/'policy.png'))
print('Policy PDF generated; text and page-count checks passed.')
