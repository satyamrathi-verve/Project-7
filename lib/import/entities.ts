import type { EntityConfig } from "./types";

/*
  One EntityConfig per importable type. To add a new import type (Products, Vendors,
  Payments…), add a new EntityConfig here and register it in ENTITY_CONFIGS below —
  every wizard step (mapping, validation, config, execution) reads from this list, so
  nothing else needs to change.

  Two fields are intentionally NOT stored per-row, because the `customers` table this
  project reads/writes (supabase/seed.sql) has no columns for them and this project's
  rule is "never alter the backend":
   - Country / State: there's only a single `address` text column, so these two extra
     mapping targets get folded into `address` at import time (see runner.ts).
   - Currency: there's no per-customer currency column at all, so it's captured once
     for the whole file in Step 5 (Import Configuration) instead of per row.
*/

const CUSTOMERS: EntityConfig = {
  entity: "customers",
  label: "Customers",
  description: "Add or update the companies you invoice — codes, contacts, credit terms.",
  table: "customers",
  uniqueKey: "code",
  mandatoryHighlights: [
    { label: "Customer Code", note: "A unique short code — also how updates are matched to an existing customer." },
    { label: "Customer Name", note: "The company's name." },
  ],
  fields: [
    { key: "code", label: "Customer Code", required: true, type: "text", synonyms: ["code", "customercode", "custcode", "clientcode", "id"], help: "A unique short code — also required by the system, since it's how updates are matched." },
    { key: "name", label: "Customer Name", required: true, type: "text", synonyms: ["name", "customername", "company", "companyname", "clientname", "fullname"] },
    { key: "email", label: "Email", required: false, type: "email", synonyms: ["email", "emailaddress", "e-mail"] },
    { key: "phone", label: "Phone", required: false, type: "text", synonyms: ["phone", "phonenumber", "mobile", "contactnumber", "tel"] },
    { key: "contact_person", label: "Contact Person", required: false, type: "text", synonyms: ["contact", "contactperson", "contactname", "attn", "attention"] },
    { key: "address", label: "Address", required: false, type: "text", synonyms: ["address", "billingaddress", "location", "street"] },
    { key: "state", label: "State", required: false, type: "text", synonyms: ["state", "province", "region"], help: "Merged into the Address field on import (this system stores one combined address, not separate columns)." },
    { key: "country", label: "Country", required: false, type: "text", synonyms: ["country", "nation"], help: "Merged into the Address field on import (this system stores one combined address, not separate columns)." },
    { key: "gstin", label: "GSTIN", required: false, type: "text", synonyms: ["gstin", "gstnumber", "gst"] },
    { key: "pan", label: "PAN", required: false, type: "text", synonyms: ["pan", "pannumber"] },
    { key: "credit_limit", label: "Credit Limit", required: false, type: "number", synonyms: ["creditlimit", "limit", "creditamount"], help: "Defaults to 0 when blank." },
    { key: "credit_days", label: "Billing Terms (Credit Days)", required: false, type: "number", synonyms: ["creditdays", "paymentterms", "terms", "netdays", "billingterms"], help: "Defaults to 30 when blank." },
    { key: "opening_balance", label: "Opening Balance", required: false, type: "number", synonyms: ["openingbalance", "openingbal", "brought forward"], help: "Defaults to 0 when blank." },
  ],
  sampleRows: [
    {
      code: "CUST101",
      name: "Acme Retail Pvt Ltd",
      email: "rakesh@acmeretail.in",
      phone: "+91 98765 43210",
      contact_person: "Rakesh Kumar",
      address: "12 MG Road",
      state: "Maharashtra",
      country: "India",
      gstin: "27AACCA1111A1Z1",
      pan: "AACCA1111A",
      credit_limit: "500000",
      credit_days: "30",
      opening_balance: "0",
    },
    {
      code: "CUST102",
      name: "Northgate Traders",
      email: "sunita@northgate.in",
      phone: "+91 91234 56789",
      contact_person: "Sunita Rao",
      address: "44 Connaught Place",
      state: "Delhi",
      country: "India",
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
  mandatoryHighlights: [
    { label: "Invoice Date", note: "When the invoice was raised." },
    { label: "Customer ID", note: "Must match an existing Customer Master code (or gets auto-created, if enabled in Step 5)." },
    { label: "Invoice Amount", note: "The invoice's total amount." },
    { label: "Invoice No.", note: "Also required — every invoice needs a unique number in the system, even though it's not on the business list above." },
  ],
  fields: [
    { key: "invoice_no", label: "Invoice No.", required: true, type: "text", synonyms: ["invoiceno", "invoicenumber", "billno", "invoice#", "invoiceid"] },
    { key: "invoice_date", label: "Invoice Date", required: true, type: "date", synonyms: ["invoicedate", "date", "billdate"] },
    { key: "customer_code", label: "Customer ID", required: true, type: "text", synonyms: ["customercode", "custcode", "customer", "clientcode", "client", "customerid"], help: "Must match an existing Customer Master code (or will be auto-created, if enabled)." },
    { key: "total", label: "Invoice Amount", required: true, type: "number", synonyms: ["total", "grandtotal", "invoicetotal", "amountdue", "invoiceamount", "amount"] },
    { key: "tax_amount", label: "Tax Amount", required: false, type: "number", synonyms: ["taxamount", "tax", "gst", "taxamt"], help: "Defaults to 0 when blank." },
    { key: "subtotal", label: "Subtotal", required: false, type: "number", synonyms: ["subtotal", "taxableamount", "netamount"], help: "Computed as Invoice Amount minus Tax when left blank." },
    { key: "due_date", label: "Due Date", required: false, type: "date", synonyms: ["duedate", "paymentduedate"], help: "Auto-filled from invoice date + customer's credit days when left blank." },
    { key: "status", label: "Status", required: false, type: "enum", enumValues: ["open", "partial", "paid", "overdue"], synonyms: ["status", "invoicestatus"], help: "Defaults to \"open\" when blank." },
    { key: "notes", label: "Notes", required: false, type: "text", synonyms: ["notes", "remarks", "comment", "description"] },
  ],
  sampleRows: [
    {
      invoice_no: "INV-2001",
      invoice_date: "2026-06-01",
      customer_code: "CUST101",
      total: "53100",
      tax_amount: "8100",
      subtotal: "45000",
      due_date: "2026-07-01",
      status: "open",
      notes: "June retainer",
    },
    {
      invoice_no: "INV-2002",
      invoice_date: "2026-06-05",
      customer_code: "CUST102",
      total: "21240",
      tax_amount: "3240",
      subtotal: "",
      due_date: "",
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
