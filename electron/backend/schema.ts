import {int, real, sqliteTable, text} from "drizzle-orm/sqlite-core";
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';

// ------------------------------------------------------------------
// TABLES
// ------------------------------------------------------------------

export const settingsTable = sqliteTable('settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull()
});

export const locationTable = sqliteTable("locationTable", {
    id: int().primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    color: text("colorHex"),

    // Pricing Structure Defaults
    hourlyRate: real("hourlyRate").default(19.91),
    flatSessionPrice: real("flatSessionPrice").default(130.00),
    extendedHourlyRate: real("extendedHourlyRate").default(12.50),
    shortSessionHourCap: real("shortSessionHourCap").default(3.5),
    fullSessionHourCap: real("fullSessionHourCap").default(8.0)
});

export const renterTable = sqliteTable("renterTable", {
    id: int().primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull()
    groupId: int("groupId").references(() => renterGroupTable.id, { onDelete: "set null" }),
})

export const renterGroupTable = sqliteTable("renterGroup", {
    id: int().primaryKey({ autoIncrement: true }),
    name: text("GroupName").notNull(),
    groupId: int("groupId").references((): AnySQLiteColumn => renterGroupTable.id,
        { onDelete: "set null" }),
    // renterGroup: int("groupId").references(() => renterGroupTable.id, { onDelete: "set null" }),

});

export const bookingTable = sqliteTable('bookingTable', {
    id: int().primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    locationId: int('location_id')
        .notNull()
        .references(() => locationTable.id, { onDelete: 'cascade' }),
    renterId: int('renter_id')
        .notNull()
        .references(() => renterTable.id, { onDelete: 'cascade' }),
    oneOffRenterName: text('one_off_renter_name'),

    // Time slots
    startHour: int('start_hour').notNull(),
    startMinute: int('start_minute').notNull(),
    endHour: int('end_hour').notNull(),
    endMinute: int('end_minute').notNull(),

    // Recurrence & Dates
    recurrence: text('recurrence', { enum: ['none', 'weekly'] }).notNull().default('none'),
    dayOfWeek: int('day_of_week'), // 0 (Sun) - 6 (Sat)
    date: text('date'), // YYYY-MM-DD for single events
    fromDate: text('from_date'), // YYYY-MM-DD start range for recurring bookings
    toDate: text('to_date'), // YYYY-MM-DD end range for recurring bookings

    // Pricing & Metadata
    // category: text('category'),
    priceOverride: real('price_override'), // Single optional value to override dynamic calculation

    // Array of ISO date strings stored as JSON text: ["2026-03-15", "2026-04-01"]
    excludedDates: text('excluded_dates', { mode: 'json' }).$type<string[]>()
});

// ------------------------------------------------------------------
// RELATIONS
// ------------------------------------------------------------------
export const renterGroupRelations = relations(renterGroupTable, ({ one, many }) => ({
    // 1. Direct members in this group
    renters: many(renterTable),

    // 2. Self-referencing parent group
    parentGroup: one(renterGroupTable, {
        fields: [renterGroupTable.groupId],
        references: [renterGroupTable.id],
        relationName: 'parent_child_groups',
    }),

    // 3. Self-referencing sub-groups
    subGroups: many(renterGroupTable, {
        relationName: 'parent_child_groups',
    }),
}));

export const renterTableRelations = relations(renterTable, ({ one, many }) => ({
    // Fixed: Added relation link to renterGroupTable
    group: one(renterGroupTable, {
        fields: [renterTable.groupId],
        references: [renterGroupTable.id],
    }),
    bookingTable: many(bookingTable),
}));

export const locationTableRelations = relations(locationTable, ({ many }) => ({
    bookings: many(bookingTable)
}));

export const renterTableRelations = relations(renterTable, ({ many }) => ({
    bookings: many(bookingTable)
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

export type LocationSchema = InferSelectModel<typeof locationTable>;
export type NewLocationSchema = InferInsertModel<typeof locationTable>;

export type RenterSchema = InferSelectModel<typeof renterTable>;
export type NewRenterSchema = InferInsertModel<typeof renterTable>;

export type BookingSchema = InferSelectModel<typeof bookingTable>;
export type NewBookingSchema = InferInsertModel<typeof bookingTable>;

export type renterGroupTableschema = InferSelectModel<typeof renterGroupTable>;
export type NewrenterGroupTableschema = InferInsertModel<typeof renterGroupTable>;