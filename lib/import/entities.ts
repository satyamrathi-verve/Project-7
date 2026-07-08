import type { EntityConfig } from "./types";

/*
  One EntityConfig per importable type. To add a new import type (Products, Vendors,
  Payments…), add a new EntityConfig here and register it in ENTITY_CONFIGS below —
  every wizard step (mapping, validation, config, execution) reads from this list, so
  nothing else needs to change.
*/

const CUSTOMERS: EntityConfig = {
  entity: "customers",
  label: "Customers",
  description: "Add or update the companies you invoice — codes, contacts, credit terms.",
  table: "customers",
  uniqueKey: "code",
  fields: [
    { key: "code", label: "Customer Code", required: true, type: "text", synonyms: ["code", "customercode", "custcode", "clientcode", "id"] },
    { key: "name", label: "Customer Name", required: true, type: "text", synonyms: ["name", "customername", "company", "companyname", "clientname", "fullname"] },
    { key: "contact_person", label: "Contact Person", required: false, type: "text", synonyms: ["contact", "contactperson", "contactname", "attn", "attention"] },
    { key: "email", label: "Email", required: false, type: "email", synonyms: ["email", "emailaddress", "e-mail"] },
    { key: "phone", label: "Phone", required: false, type: "text", synonyms: ["phone", "phonenumber", "mobile", "contactnumber", "tel"] },
    { key: "address", label: "Address", required: false, type: "text", synonyms: ["address", "billingaddress", "location"] },
    { key: "gstin", label: "GSTIN", required: false, type: "text", synonyms: ["gstin", "gstnumber", "gst"] },
    { key: "pan", label: "PAN", required: false, type: "text", synonyms: ["pan", "pannumber"] },
    { key: "credit_limit", label: "Credit Limit", required: false, type: "number", synonyms: ["creditlimit", "limit", "creditamount"], help: "Defaults to 0 when blank." },
    { key: "credit_days", label: "Credit Days", required: false, type: "number", synonyms: ["creditdays", "paymentterms", "terms", "netdays"], help: "Defaults to 30 when blank." },
    { key: "opening_balance", label: "Opening Balance", required: false, type: "number", synonyms: ["openingbalance", "openingbal", "brought forward"], help: "Defaults to 0 when blank." },
  ],
  sampleRows: [
    {
      code: "CUST101",
      name: "Acme Retail Pvt Ltd",
      contact_person: "Rakesh Kumar",
      email: "rakesh@acmeretail.in",
      phone: "+91 98765 43210",
      address: "Mumbai",
      gstin: "27AACCA1111A1Z1",
      pan: "AACCA1111A",
      credit_limit: "500000",
      credit_days: "30",
      opening_balance: "0",
    },
    {
      code: "CUST102",
      name: "Northgate Traders",
      contact_person: "Sunita Rao",
      email: "sunita@northgate.in",
      phone: "+91 91234 56789",
      address: "Delhi",
      gstin: "",
      pan: "",
      credit_limit: "250000",
      credit_days: "15",
      opening_balance: "5000",
    },
  ],
};

const INVOICES: EntityConfig = {
  entity: "invoices",
  label: "Invoices",
  description: "Bulk-punch invoice headers — one row per invoice, matched to an existing customer.",
  table: "invoices",
  uniqueKey: "invoice_no",
  fields: [
    { key: "invoice_no", label: "Invoice No.", required: true, type: "text", synonyms: ["invoiceno", "invoicenumber", "billno", "invoice#", "invoiceid"] },
    { key: "invoice_date", label: "Invoice Date", required: true, type: "date", synonyms: ["invoicedate", "date", "billdate"] },
    { key: "customer_code", label: "Customer Code", required: true, type: "text", synonyms: ["customercode", "custcode", "customer", "clientcode", "client"], help: "Must match an existing Customer Master code (or will be auto-created, if enabled)." },
    { key: "due_date", label: "Due Date", required: false, type: "date", synonyms: ["duedate", "paymentduedate"], help: "Auto-filled from invoice date + customer's credit days when left blank." },
    { key: "subtotal", label: "Subtotal", required: true, type: "number", synonyms: ["subtotal", "amount", "taxableamount", "netamount"] },
    { key: "tax_amount", label: "Tax Amount", required: false, type: "number", synonyms: ["taxamount", "tax", "gst", "taxamt"], help: "Defaults to 0 when blank." },
    { key: "total", label: "Total", required: false, type: "number", synonyms: ["total", "grandtotal", "invoicetotal", "amountdue"], help: "Computed from subtotal + tax when left blank." },
    { key: "status", label: "Status", required: false, type: "enum", enumValues: ["open", "partial", "paid", "overdue"], synonyms: ["status", "invoicestatus"], help: "Defaults to \"open\" when blank." },
    { key: "notes", label: "Notes", required: false, type: "text", synonyms: ["notes", "remarks", "comment", "description"] },
  ],
  sampleRows: [
    {
      invoice_no: "INV-2001",
      invoice_date: "2026-06-01",
      customer_code: "CUST101",
      due_date: "2026-07-01",
      subtotal: "45000",
      tax_amount: "8100",
      total: "53100",
      status: "open",
      notes: "June retainer",
    },
    {
      invoice_no: "INV-2002",
      invoice_date: "2026-06-05",
      customer_code: "CUST102",
      due_date: "",
      subtotal: "18000",
      tax_amount: "3240",
      total: "",
      status: "",
      notes: "",
    },
  ],
};

export const ENTITY_CONFIGS: Record<string, EntityConfig> = {
  customers: CUSTOMERS,
  invoices: INVOICES,
};

export const ENTITY_LIST: EntityConfig[] = [CUSTOMERS, INVOICES];
