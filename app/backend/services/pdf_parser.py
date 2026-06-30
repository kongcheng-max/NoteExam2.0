"""V1.1: PDF parsing - text extraction + OCR fallback"""
import os
import fitz
from services.ocr import ocr_service


class PDFParser:
    """PDF text extraction, auto-detect text vs scanned"""
    TEXT_MIN_LENGTH = 50

    def extract_text(self, pdf_path):
        """Extract text, auto-detect type"""
        doc = fitz.open(pdf_path)
        parts = []
        for page in doc:
            t = page.get_text()
            if t.strip():
                parts.append(t.strip())
        doc.close()
        text = "\n\n".join(parts)
        if len(text) >= self.TEXT_MIN_LENGTH:
            return text
        return self._ocr_pdf(pdf_path)

    def _ocr_pdf(self, pdf_path):
        """Render pages to images, OCR each"""
        doc = fitz.open(pdf_path)
        texts = []
        for i, page in enumerate(doc):
            pix = page.get_pixmap(dpi=200)
            img_path = pdf_path + f"_page_{i}.png"
            pix.save(img_path)
            try:
                t = ocr_service.recognize_image(img_path)
                if t.strip():
                    texts.append(t)
            finally:
                if os.path.exists(img_path):
                    os.remove(img_path)
        doc.close()
        return "\n\n".join(texts)


pdf_parser = PDFParser()
