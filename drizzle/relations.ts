import { relations } from "drizzle-orm/relations";
import { datapointValues, validationEvents, users, organizations, companies, auditEvents, projects, documents, evidenceLinks, datapoints, extractionRuns, extractedFields } from "./schema";

export const validationEventsRelations = relations(validationEvents, ({one}) => ({
	datapointValue: one(datapointValues, {
		fields: [validationEvents.datapointValueId],
		references: [datapointValues.id]
	}),
	user: one(users, {
		fields: [validationEvents.userId],
		references: [users.id]
	}),
}));

export const datapointValuesRelations = relations(datapointValues, ({one, many}) => ({
	validationEvents: many(validationEvents),
	evidenceLinks: many(evidenceLinks),
	project: one(projects, {
		fields: [datapointValues.projectId],
		references: [projects.id]
	}),
	datapoint: one(datapoints, {
		fields: [datapointValues.datapointId],
		references: [datapoints.id]
	}),
	document: one(documents, {
		fields: [datapointValues.sourceDocumentId],
		references: [documents.id]
	}),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	validationEvents: many(validationEvents),
	organization: one(organizations, {
		fields: [users.organizationId],
		references: [organizations.id]
	}),
}));

export const organizationsRelations = relations(organizations, ({many}) => ({
	users: many(users),
	companies: many(companies),
	auditEvents: many(auditEvents),
	projects: many(projects),
}));

export const companiesRelations = relations(companies, ({one, many}) => ({
	organization: one(organizations, {
		fields: [companies.organizationId],
		references: [organizations.id]
	}),
	projects: many(projects),
}));

export const auditEventsRelations = relations(auditEvents, ({one}) => ({
	organization: one(organizations, {
		fields: [auditEvents.organizationId],
		references: [organizations.id]
	}),
	project: one(projects, {
		fields: [auditEvents.projectId],
		references: [projects.id]
	}),
}));

export const projectsRelations = relations(projects, ({one, many}) => ({
	auditEvents: many(auditEvents),
	documents: many(documents),
	organization: one(organizations, {
		fields: [projects.organizationId],
		references: [organizations.id]
	}),
	company: one(companies, {
		fields: [projects.companyId],
		references: [companies.id]
	}),
	datapointValues: many(datapointValues),
}));

export const documentsRelations = relations(documents, ({one, many}) => ({
	project: one(projects, {
		fields: [documents.projectId],
		references: [projects.id]
	}),
	evidenceLinks: many(evidenceLinks),
	datapointValues: many(datapointValues),
	extractionRuns: many(extractionRuns),
}));

export const evidenceLinksRelations = relations(evidenceLinks, ({one}) => ({
	datapointValue: one(datapointValues, {
		fields: [evidenceLinks.datapointValueId],
		references: [datapointValues.id]
	}),
	document: one(documents, {
		fields: [evidenceLinks.documentId],
		references: [documents.id]
	}),
}));

export const datapointsRelations = relations(datapoints, ({many}) => ({
	datapointValues: many(datapointValues),
	extractedFields: many(extractedFields),
}));

export const extractionRunsRelations = relations(extractionRuns, ({one, many}) => ({
	document: one(documents, {
		fields: [extractionRuns.documentId],
		references: [documents.id]
	}),
	extractedFields: many(extractedFields),
}));

export const extractedFieldsRelations = relations(extractedFields, ({one}) => ({
	extractionRun: one(extractionRuns, {
		fields: [extractedFields.extractionRunId],
		references: [extractionRuns.id]
	}),
	datapoint: one(datapoints, {
		fields: [extractedFields.datapointId],
		references: [datapoints.id]
	}),
}));