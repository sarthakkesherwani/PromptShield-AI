import openpyxl
import os

def create_demo_files():
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "demo_samples")
    os.makedirs(out_dir, exist_ok=True)

    # 1. customers.xlsx
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    ws.append(["Name", "Email", "Account ID"])
    ws.append(["Rahul", "rahul@example.com", "ACC-12345"])
    ws.append(["Priya", "priya@example.com", "ACC-67890"])
    
    xlsx_path = os.path.join(out_dir, "customers.xlsx")
    wb.save(xlsx_path)
    print("Created", xlsx_path)

    # 2. customers.csv
    csv_path = os.path.join(out_dir, "customers.csv")
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write("Name,Email,Account ID\n")
        f.write("Rahul,rahul@example.com,ACC-12345\n")
        f.write("Priya,priya@example.com,ACC-67890\n")
    print("Created", csv_path)

    # 3. confidential_project_brief.txt
    confidential_path = os.path.join(out_dir, "confidential_project_brief.txt")
    with open(confidential_path, "w", encoding="utf-8") as f:
        f.write("CONFIDENTIAL & INTERNAL ONLY: Project Titan Q4 Quote\n")
        f.write("The secret quotation agreed with Apex Corp is $4,850,000.\n")
        f.write("Do not distribute outside executive circle. Use API key sk-live99482710492817491028 to query the private ledger.\n")
    print("Created", confidential_path)

    # 4. unsupported_binary.dat (simulate unreadable/corrupted file)
    unsupported_path = os.path.join(out_dir, "unsupported_binary.dat")
    with open(unsupported_path, "wb") as f:
        f.write(b"\x00\xFF\xFE\x00\x12\x34\x56\x78\x9A\xBC\xDE\xF0CorruptHeaderData")
    print("Created", unsupported_path)

    # 5. create a sample PDF with sensitive info if pymupdf is available
    try:
        import pymupdf
        pdf_doc = pymupdf.open()
        page = pdf_doc.new_page()
        text = (
            "Quarterly Customer Operations Report\n\n"
            "Confidentiality Notice: This document contains internal customer accounts.\n\n"
            "Key escalation contacts:\n"
            "- Sarah Connor: sarah.c@cyberdyne.org, Phone: +1-555-0143, Account: ACC-33441\n"
            "- John Matrix: matrix.j@command.mil, Phone: +1-555-0188, Account: ACC-99221\n"
        )
        page.insert_text((50, 72), text, fontsize=12)
        pdf_path = os.path.join(out_dir, "customer_escalations.pdf")
        pdf_doc.save(pdf_path)
        pdf_doc.close()
        print("Created", pdf_path)
    except Exception as e:
        print("PDF creation note:", e)

if __name__ == "__main__":
    create_demo_files()
