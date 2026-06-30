"""V1.1: Baidu OCR integration service"""
import os
from aip import AipOcr
from config import BAIDU_OCR_APP_ID, BAIDU_OCR_API_KEY, BAIDU_OCR_SECRET_KEY


class OCRService:
    """Baidu OCR service wrapper"""

    def __init__(self):
        self.client = None
        if BAIDU_OCR_APP_ID and BAIDU_OCR_API_KEY and BAIDU_OCR_SECRET_KEY:
            self.client = AipOcr(BAIDU_OCR_APP_ID, BAIDU_OCR_API_KEY, BAIDU_OCR_SECRET_KEY)

    def recognize_image(self, image_path):
        """Recognize text from image"""
        if not self.client:
            raise RuntimeError("Baidu OCR not configured")
        with open(image_path, "rb") as f:
            image_data = f.read()
        result = self.client.handwriting(image_data)
        if "error_code" in result:
            msg = result.get("error_msg", "unknown")
            raise RuntimeError("OCR failed: " + str(msg))
        words = result.get("words_result", [])
        return "\n".join(item["words"] for item in words)

    def recognize_multiple(self, image_paths):
        """Recognize multiple images"""
        return "\n\n".join(self.recognize_image(p) for p in image_paths)


ocr_service = OCRService()
