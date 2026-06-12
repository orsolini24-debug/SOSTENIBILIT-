import { pgTable, text, uuid, integer, timestamp, jsonb, pgEnum, numeric, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const datapointStateEnum = pgEnum("datapoint_state", [
  "estimated",
  "declared_by_company",
  "auto_extracted_candidate",
  "rule_validated",
  "manual_review_required",
  "manually_validated",
  "rejected",
  "conflict_review",
]);

export const confidenceEnum = pgEnum("confidence", [
  "Alta",
  "Media",
  "Bassa",
  "Non determinabile",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  vatNumber: text("vat_number"),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  vatNumber: text("vat_number"),
  industry: text("industry"), // Codice ATECO
  employeesCount: integer("employees_count"),
  facilityArea: integer("facility_area"), // Superficie in mq
  hasProductionSite: text("has_production_site").default("no"), // 'yes' or 'no'
  fleetSize: integer("fleet_size").default(0), // Veicoli a combustione
  heatingSource: text("heating_source").default("gas"), // 'gas', 'electric', 'none'
  renewableElectricity: text("renewable_electricity").default("no"), // 'yes' or 'no'
  logisticsIntensity: text("logistics_intensity").default("low"), // 'low', 'medium', 'high'
  revenueRange: text("revenue_range"),
  location: text("location"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  year: integer("year").notNull(),
  status: text("status").default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type"),
  storagePath: text("storage_path").notNull(),
  hash: text("hash"),
  metadata: jsonb("metadata").default({}),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const datapoints = pgTable("datapoints", {
  id: text("id").primaryKey(), // e.g. 'VSME-B1'
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  unit: text("unit"),
  module: text("module"),
  sectorRelevance: jsonb("sector_relevance").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const datapointValues = pgTable("datapoint_values", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  datapointId: text("datapoint_id").references(() => datapoints.id),
  
  // Values
  value: text("value"), // normalized_value
  rawValue: text("raw_value"),
  unitRaw: text("unit_raw"),
  unitNormalized: text("unit_normalized"),
  period: text("period").default("FY"),
  year: integer("year"),
  disclosureId: text("disclosure_id"),
  frameworkConceptId: text("framework_concept_id"),

  // Process & Status
  state: datapointStateEnum("state").default("estimated").notNull(),
  confidence: confidenceEnum("confidence").default("Bassa").notNull(),
  extractionMethod: text("extraction_method").default("manual"),
  validationStatus: text("validation_status").default("pending"),
  reviewerDecision: text("reviewer_decision"),
  version: integer("version").default(1),
  lineageHash: text("lineage_hash"),

  // Evidence
  sourceDocumentId: uuid("source_document_id").references(() => documents.id, { onDelete: "set null" }),
  page: integer("page"),
  tableCoordinates: jsonb("table_coordinates"),
  evidenceText: text("evidence_text"),
  evidenceHash: text("evidence_hash"),
  evidenceNotes: text("evidence_notes"),

  // Operational Lineage (JSONB for extensibility)
  provenance: jsonb("provenance").$type<{
    extraction_run_id?: string;
    parser_name?: string;
    parser_version?: string;
    model_name?: string;
    model_version?: string;
    prompt_version?: string;
    validator_version?: string;
    retrieval_query?: string;
    retrieval_rank?: number;
    chunk_id?: string;
    document_version?: string;
    source_file_hash?: string;
    created_by?: string;
    reviewed_by?: string;
    reviewed_at?: string;
  }>().default({}),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  projectDpIdx: unique("project_dp_idx").on(table.projectId, table.datapointId),
}));

export const evidenceLinks = pgTable("evidence_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  datapointValueId: uuid("datapoint_value_id").references(() => datapointValues.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }),
  pageReference: integer("page_reference"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const extractionRuns = pgTable("extraction_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  promptVersion: text("prompt_version"),
  status: text("status").default("pending"),
  result: jsonb("result"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const validationEvents = pgTable("validation_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  datapointValueId: uuid("datapoint_value_id").references(() => datapointValues.id),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(), // 'approved', 'rejected', 'corrected'
  previousState: datapointStateEnum("previous_state"),
  newState: datapointStateEnum("new_state"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sectorCoefficients = pgTable("sector_coefficients", {
  id: uuid("id").defaultRandom().primaryKey(),
  atecoPrefix: text("ateco_prefix").notNull(),        // es. "20", "22", "10-11", "generic"
  coefficientType: text("coefficient_type").notNull(), // es. "kwh_per_sqm", "kwh_per_employee", "waste_per_employee", "water_per_employee", "fgas_per_100sqm"
  value: numeric("value", { precision: 10, scale: 4 }).notNull(),
  unit: text("unit").notNull(),                        // es. "kWh/mq", "kWh/addetto", "t/addetto", "m3/addetto"
  source: text("source"),                              // es. "Intesa Sanpaolo Report 2023", "RX PACK Bilancio 2023"
  sampleSize: integer("sample_size"),                  // numero di aziende nel campione
  confidence: confidenceEnum("confidence").default("Media"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const extractedFields = pgTable("extracted_fields", {
  id: uuid("id").defaultRandom().primaryKey(),
  extractionRunId: uuid("extraction_run_id").references(() => extractionRuns.id, { onDelete: "cascade" }),
  datapointId: text("datapoint_id").references(() => datapoints.id), // Collegamento suggerito al VSME
  fieldName: text("field_name").notNull(),
  value: text("value"),
  confidence: text("confidence"), // "Alta", "Media", "Bassa"
  pageReference: integer("page_reference"),
  sourceSnippet: text("source_snippet"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentChunks = pgTable("document_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }).notNull(),
  page: integer("page").notNull(),
  chunkIdx: integer("chunk_idx").notNull().default(0),
  tableId: text("table_id"),
  rowIdx: integer("row_idx"),
  colIdx: integer("col_idx"),
  heading: text("heading"),
  bbox: jsonb("bbox"),
  sourceHash: text("source_hash").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  docPageIdx: index("doc_page_idx").on(table.documentId, table.page),
  sourcePageChunkUnq: unique("source_page_chunk_unq").on(table.sourceHash, table.page, table.chunkIdx),
}));

export const extractionCandidates = pgTable("extraction_candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  extractionRunId: uuid("extraction_run_id").references(() => extractionRuns.id, { onDelete: "cascade" }),
  datapointId: text("datapoint_id").references(() => datapoints.id),
  rawValue: text("raw_value"),
  normalizedValue: text("normalized_value"),
  unitRaw: text("unit_raw"),
  unitNormalized: text("unit_normalized"),
  confidence: confidenceEnum("confidence").default("Bassa"),
  pageReference: integer("page_reference"),
  evidenceText: text("evidence_text"),
  tableCoordinates: jsonb("table_coordinates"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const validationResults = pgTable("validation_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  datapointValueId: uuid("datapoint_value_id").references(() => datapointValues.id, { onDelete: "cascade" }),
  ruleId: text("rule_id").notNull(),
  status: text("status").notNull(), // 'pass', 'fail', 'warning'
  message: text("message"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reviewDecisions = pgTable("review_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  datapointValueId: uuid("datapoint_value_id").references(() => datapointValues.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id),
  decision: text("decision").notNull(), // 'approved', 'rejected', 'corrected'
  comment: text("comment"),
  correctedValue: text("corrected_value"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vsmeMapping = pgTable("vsme_mapping", {
  id: uuid("id").defaultRandom().primaryKey(),
  vsmeId: text("vsme_id").references(() => datapoints.id),
  externalFramework: text("external_framework").notNull(), // e.g. 'ESRS', 'GRI'
  externalId: text("external_id").notNull(),
  mappingType: text("mapping_type").default("direct"), // 'direct', 'derived', 'proxy'
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clusterDefinitions = pgTable("cluster_definitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  atecoPrefix: text("ateco_prefix").notNull(),
  sizeClass: text("size_class").notNull(), // 'micro', 'small', 'medium', 'large'
  description: text("description"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sectorDistributions = pgTable("sector_distributions", {
  id: uuid("id").defaultRandom().primaryKey(),
  clusterId: uuid("cluster_id").references(() => clusterDefinitions.id, { onDelete: "cascade" }),
  indicatorId: text("indicator_id").references(() => datapoints.id),
  p25: numeric("p25", { precision: 15, scale: 4 }),
  median: numeric("median", { precision: 15, scale: 4 }),
  p75: numeric("p75", { precision: 15, scale: 4 }),
  nSamples: integer("n_sample"),
  sourceType: text("source_type").default("statistical"), // 'statistical', 'client_flywheel'
  period: text("period").default("FY2024"),
  version: text("version").default("1.0"),
  computedAt: timestamp("computed_at").defaultNow(),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  companies: many(companies),
  projects: many(projects),
  users: many(users),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [companies.organizationId],
    references: [organizations.id],
  }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  company: one(companies, {
    fields: [projects.companyId],
    references: [companies.id],
  }),
  documents: many(documents),
  datapointValues: many(datapointValues),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  project: one(projects, {
    fields: [documents.projectId],
    references: [projects.id],
  }),
  datapointValues: many(datapointValues),
  chunks: many(documentChunks),
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
}));

export const extractionRunsRelations = relations(extractionRuns, ({ one, many }) => ({
  document: one(documents, {
    fields: [extractionRuns.documentId],
    references: [documents.id],
  }),
  candidates: many(extractionCandidates),
}));

export const extractionCandidatesRelations = relations(extractionCandidates, ({ one }) => ({
  run: one(extractionRuns, {
    fields: [extractionCandidates.extractionRunId],
    references: [extractionRuns.id],
  }),
  datapoint: one(datapoints, {
    fields: [extractionCandidates.datapointId],
    references: [datapoints.id],
  }),
}));

export const validationResultsRelations = relations(validationResults, ({ one }) => ({
  datapointValue: one(datapointValues, {
    fields: [validationResults.datapointValueId],
    references: [datapointValues.id],
  }),
}));

export const reviewDecisionsRelations = relations(reviewDecisions, ({ one }) => ({
  datapointValue: one(datapointValues, {
    fields: [reviewDecisions.datapointValueId],
    references: [datapointValues.id],
  }),
  user: one(users, {
    fields: [reviewDecisions.userId],
    references: [users.id],
  }),
}));

export const vsmeMappingRelations = relations(vsmeMapping, ({ one }) => ({
  vsme: one(datapoints, {
    fields: [vsmeMapping.vsmeId],
    references: [datapoints.id],
  }),
}));

export const clusterDefinitionsRelations = relations(clusterDefinitions, ({ many }) => ({
  distributions: many(sectorDistributions),
}));

export const sectorDistributionsRelations = relations(sectorDistributions, ({ one }) => ({
  cluster: one(clusterDefinitions, {
    fields: [sectorDistributions.clusterId],
    references: [clusterDefinitions.id],
  }),
  indicator: one(datapoints, {
    fields: [sectorDistributions.indicatorId],
    references: [datapoints.id],
  }),
}));

export const datapointValuesRelations = relations(datapointValues, ({ one, many }) => ({
  project: one(projects, {
    fields: [datapointValues.projectId],
    references: [projects.id],
  }),
  datapoint: one(datapoints, {
    fields: [datapointValues.datapointId],
    references: [datapoints.id],
  }),
  sourceDocument: one(documents, {
    fields: [datapointValues.sourceDocumentId],
    references: [documents.id],
  }),
  evidenceLinks: many(evidenceLinks),
  validationResults: many(validationResults),
  reviewDecisions: many(reviewDecisions),
}));

export const evidenceLinksRelations = relations(evidenceLinks, ({ one }) => ({
  datapointValue: one(datapointValues, {
    fields: [evidenceLinks.datapointValueId],
    references: [datapointValues.id],
  }),
  document: one(documents, {
    fields: [evidenceLinks.documentId],
    references: [documents.id],
  }),
}));
