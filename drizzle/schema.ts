import { pgTable, foreignKey, uuid, text, timestamp, numeric, integer, jsonb, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const confidence = pgEnum("confidence", ['Alta', 'Media', 'Bassa', 'Non determinabile'])
export const datapointState = pgEnum("datapoint_state", ['Stimato', 'Dichiarato', 'Estratto', 'Validato', 'Calcolato', 'Archiviato'])


export const validationEvents = pgTable("validation_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	datapointValueId: uuid("datapoint_value_id"),
	userId: uuid("user_id"),
	action: text().notNull(),
	previousState: datapointState("previous_state"),
	newState: datapointState("new_state"),
	reason: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.datapointValueId],
			foreignColumns: [datapointValues.id],
			name: "validation_events_datapoint_value_id_datapoint_values_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "validation_events_user_id_users_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	fullName: text("full_name"),
	organizationId: uuid("organization_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "users_organization_id_organizations_id_fk"
		}),
]);

export const sectorCoefficients = pgTable("sector_coefficients", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	atecoPrefix: text("ateco_prefix").notNull(),
	coefficientType: text("coefficient_type").notNull(),
	value: numeric({ precision: 10, scale:  4 }).notNull(),
	unit: text().notNull(),
	source: text(),
	sampleSize: integer("sample_size"),
	confidence: confidence().default('Media'),
	lastUpdated: timestamp("last_updated", { mode: 'string' }).defaultNow(),
});

export const companies = pgTable("companies", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id"),
	name: text().notNull(),
	vatNumber: text("vat_number"),
	industry: text(),
	employeesCount: integer("employees_count"),
	revenueRange: text("revenue_range"),
	location: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	facilityArea: integer("facility_area"),
	hasProductionSite: text("has_production_site").default('no'),
	fleetSize: integer("fleet_size").default(0),
	heatingSource: text("heating_source").default('gas'),
	renewableElectricity: text("renewable_electricity").default('no'),
	logisticsIntensity: text("logistics_intensity").default('low'),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "companies_organization_id_organizations_id_fk"
		}).onDelete("cascade"),
]);

export const auditEvents = pgTable("audit_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id"),
	projectId: uuid("project_id"),
	entityType: text("entity_type").notNull(),
	entityId: uuid("entity_id").notNull(),
	action: text().notNull(),
	oldValue: jsonb("old_value"),
	newValue: jsonb("new_value"),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "audit_events_organization_id_organizations_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "audit_events_project_id_projects_id_fk"
		}).onDelete("cascade"),
]);

export const documents = pgTable("documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	projectId: uuid("project_id"),
	name: text().notNull(),
	type: text(),
	storagePath: text("storage_path").notNull(),
	hash: text(),
	metadata: jsonb().default({}),
	status: text().default('pending'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "documents_project_id_projects_id_fk"
		}).onDelete("cascade"),
]);

export const evidenceLinks = pgTable("evidence_links", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	datapointValueId: uuid("datapoint_value_id"),
	documentId: uuid("document_id"),
	pageReference: integer("page_reference"),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.datapointValueId],
			foreignColumns: [datapointValues.id],
			name: "evidence_links_datapoint_value_id_datapoint_values_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "evidence_links_document_id_documents_id_fk"
		}).onDelete("cascade"),
]);

export const organizations = pgTable("organizations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	vatNumber: text("vat_number"),
	settings: jsonb().default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const projects = pgTable("projects", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id"),
	companyId: uuid("company_id"),
	name: text().notNull(),
	year: integer().notNull(),
	status: text().default('draft').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "projects_organization_id_organizations_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "projects_company_id_companies_id_fk"
		}).onDelete("cascade"),
]);

export const datapointValues = pgTable("datapoint_values", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	projectId: uuid("project_id"),
	datapointId: text("datapoint_id"),
	value: text(),
	state: datapointState().default('Stimato').notNull(),
	confidence: confidence().default('Bassa').notNull(),
	sourceDocumentId: uuid("source_document_id"),
	evidenceNotes: text("evidence_notes"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "datapoint_values_project_id_projects_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.datapointId],
			foreignColumns: [datapoints.id],
			name: "datapoint_values_datapoint_id_datapoints_id_fk"
		}),
	foreignKey({
			columns: [table.sourceDocumentId],
			foreignColumns: [documents.id],
			name: "datapoint_values_source_document_id_documents_id_fk"
		}).onDelete("set null"),
]);

export const datapoints = pgTable("datapoints", {
	id: text().primaryKey().notNull(),
	code: text().notNull(),
	name: text().notNull(),
	description: text(),
	unit: text(),
	module: text(),
	sectorRelevance: jsonb("sector_relevance").default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const extractionRuns = pgTable("extraction_runs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid("document_id"),
	model: text().notNull(),
	promptVersion: text("prompt_version"),
	status: text().default('pending'),
	result: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "extraction_runs_document_id_documents_id_fk"
		}).onDelete("cascade"),
]);

export const extractedFields = pgTable("extracted_fields", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	extractionRunId: uuid("extraction_run_id"),
	datapointId: text("datapoint_id"),
	fieldName: text("field_name").notNull(),
	value: text(),
	confidence: text(),
	pageReference: integer("page_reference"),
	sourceSnippet: text("source_snippet"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.extractionRunId],
			foreignColumns: [extractionRuns.id],
			name: "extracted_fields_extraction_run_id_extraction_runs_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.datapointId],
			foreignColumns: [datapoints.id],
			name: "extracted_fields_datapoint_id_datapoints_id_fk"
		}),
]);
