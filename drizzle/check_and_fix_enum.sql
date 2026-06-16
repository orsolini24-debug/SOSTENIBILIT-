-- ============================================================
-- C4: Verifica e Fix dell'enum datapointState su Neon
-- ============================================================
-- ISTRUZIONI: eseguire questo script su Neon console (SQL editor)
-- in due fasi:
--
-- FASE 1: Verifica lo stato attuale dell'enum
-- ============================================================

SELECT enumlabel, enumsortorder
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'datapoint_state'
ORDER BY enumsortorder;

-- ATTESO (codice attuale usa valori inglesi):
--   estimated, declared, extracted, manually_validated,
--   calculated, manual_review_required, archived
--
-- SE vedi valori italiani ('Stimato', 'Dichiarato'...):
-- → il DB Neon ha l'enum legacy → eseguire FASE 2
--
-- SE vedi valori inglesi → enum già corretto, non fare nulla.

-- ============================================================
-- FASE 2: Fix enum da italiano a inglese
-- DA ESEGUIRE SOLO SE FASE 1 MOSTRA VALORI ITALIANI
-- ============================================================

-- 2a. Crea nuovo tipo temporaneo con i valori corretti
-- CREATE TYPE datapoint_state_new AS ENUM (
--   'estimated',
--   'declared',
--   'extracted',
--   'manually_validated',
--   'calculated',
--   'manual_review_required',
--   'archived'
-- );

-- 2b. Aggiorna la colonna (assume colonna 'state' in 'datapoint_values')
-- ALTER TABLE datapoint_values
--   ALTER COLUMN state TYPE datapoint_state_new
--   USING state::text::datapoint_state_new;

-- 2c. Drop vecchio tipo e rinomina
-- DROP TYPE datapoint_state;
-- ALTER TYPE datapoint_state_new RENAME TO datapoint_state;

-- ============================================================
-- ALTERNATIVA SEMPLICE (se nessun dato ancora in prod):
-- Droppare e ricreare via drizzle-kit generate + migrate
-- ============================================================
-- npx drizzle-kit generate
-- npx drizzle-kit migrate
