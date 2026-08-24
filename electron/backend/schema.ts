import {int, real, sqliteTable, text} from "drizzle-orm/sqlite-core";
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';


export const settingsTable = sqliteTable('settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull()
});


export const locationTable = sqliteTable("locationTable", {
    id: int().primaryKey({ autoIncrement: true }),
    name: text("Location").notNull(),
    hourlyRate: real("hourlyRate"),
    flatSessionPrice: real("flatSessionPrice"),
    color: text("colorHex"),
});

export const renterTable = sqliteTable("renterTable", {
    id: int().primaryKey({ autoIncrement: true }),
    name: text("Renter").notNull(),
    email: text("Email").notNull(),
})

export const bookingTable = sqliteTable('bookingTable', {
    id: int('id').primaryKey({autoIncrement: true}),
    title: text('title').notNull(),
    locationId: text('location_id')
        .notNull()
        .references(() => locationTable.id, { onDelete: 'cascade' }),
    renterId: int('renter_id')
        .notNull()
        .references(() => renterTable.id, { onDelete: 'cascade' }),

    // Time slots
    startHour: int('start_hour').notNull(),
    startMinute: int('start_minute').notNull(),
    endHour: int('end_hour').notNull(),
    endMinute: int('end_minute').notNull(),

    // Recurrence rules
    recurrence: text('recurrence', { enum: ['none', 'weekly'] }).notNull().default('none'),
    dayOfWeek: int('day_of_week'), // 0 (Sun) - 6 (Sat)
    date: text('date'), // YYYY-MM-DD for non-recurring events

    // Metadata & Pricing
    category: text('category'),
    sessionPrice: real('session_price'),
    hourlyRate: real('hourly_rate'),

    // Array of ISO date strings stored as JSON text: ["2026-03-15", "2026-04-01"]
    excludedDates: text('excluded_dates', { mode: 'json' }).$type<string[]>()

})
// ------------------------------------------------------------------
// RELATIONS
// ------------------------------------------------------------------

export const locationTableRelations = relations(locationTable, ({ many }) => ({
    bookingTable: many(bookingTable)
}));

export const renterTableRelations = relations(renterTable, ({ many }) => ({
    bookingTable: many(bookingTable)
}));

export const bookingTableRelations = relations(bookingTable, ({ one }) => ({
    location: one(locationTable, {
        fields: [bookingTable.locationId],
        references: [locationTable.id]
    }),
    renter: one(renterTable, {
        fields: [bookingTable.renterId],
        references: [renterTable.id]
    })
}));



// ------------------------------------------------------------------
// TYPE INFERENCE HELPERS
// ------------------------------------------------------------------

export type locationTableschema = InferSelectModel<typeof locationTable>;
export type NewlocationTableschema = InferInsertModel<typeof locationTable>;

export type renterTableschema = InferSelectModel<typeof renterTable>;
export type NewrenterTableschema = InferInsertModel<typeof renterTable>;

export type bookingTableschema = InferSelectModel<typeof bookingTable>;
export type NewbookingTableschema = InferInsertModel<typeof bookingTable>;
