import type { Booking } from '$lib/types';
import { jsPDF } from 'jspdf';

type MonthCell = { date: Date; isCurrentMonth: boolean };
type ViewMode = 'week' | 'month';

type AgendaPdfOptions = {
    viewMode: ViewMode;
    headerLabel: string;
    locationName?: string;
    activeColor: string;
    monthGrid: MonthCell[];
    weekDays: Date[];
    getBookingsForDay: (day: Date) => Booking[];
    getRenterLabel: (booking: Booking) => string;
    startHourGrid: number;
    endHourGrid: number;
};

function fitPdfText(doc: jsPDF, value: string, width: number): string {
    let text = value;
    while (text.length > 1 && doc.getTextWidth(text) > width) {
        text = `${text.slice(0, -2)}…`;
    }
    return text;
}

function getAccentColor(activeColor: string) {
    const color = /^#([0-9a-f]{6})$/i.exec(activeColor)?.[1] || '2563eb';
    const accent = [
        parseInt(color.slice(0, 2), 16),
        parseInt(color.slice(2, 4), 16),
        parseInt(color.slice(4, 6), 16)
    ] as const;
    const lightAccent = accent.map((channel) => Math.round(channel + (255 - channel) * 0.84)) as [number, number, number];
    return { accent, lightAccent };
}

function toLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function exportMonthlyAgendaPdf(options: AgendaPdfOptions): void {
    const {
        headerLabel, locationName, activeColor, monthGrid, getBookingsForDay
    } = options;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 8;
    const contentWidth = pageWidth - margin * 2;
    const weekCount = monthGrid.length / 7;
    const titleY = margin + 6;
    const subtitleY = margin + 11;
    const gridY = margin + 18;
    const gridBottom = pageHeight - margin - 7;
    const availableGridHeight = gridBottom - gridY;
    const cellWidth = contentWidth / 7;
    const dayHeaderHeight = 7;
    const eventLineHeight = 7.5;
    const eventGap = 0.5;
    const rowPadding = 2;
    const fontSize = 9;
    const { accent, lightAccent } = getAccentColor(activeColor);
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const maxLinesPerWeekRow = Math.max(1, Math.floor(
        (availableGridHeight - dayHeaderHeight - rowPadding) / eventLineHeight
    ));
    const pages: { weekIndex: number; start: number; count: number; height: number }[][] = [[]];
    let pageHeightUsed = 0;

    for (let weekIndex = 0; weekIndex < weekCount; weekIndex++) {
        const week = monthGrid.slice(weekIndex * 7, weekIndex * 7 + 7);
        const maxBookings = Math.max(...week.map((cell) => getBookingsForDay(cell.date).length));
        const segments = Math.max(1, Math.ceil(maxBookings / maxLinesPerWeekRow));
        for (let segment = 0; segment < segments; segment++) {
            const start = segment * maxLinesPerWeekRow;
            const count = Math.min(maxLinesPerWeekRow, Math.max(0, maxBookings - start));
            const rowHeight = dayHeaderHeight + count * eventLineHeight + rowPadding;
            if (pageHeightUsed + rowHeight > availableGridHeight && pages[pages.length - 1].length > 0) {
                pages.push([]);
                pageHeightUsed = 0;
            }
            pages[pages.length - 1].push({ weekIndex, start, count, height: rowHeight });
            pageHeightUsed += rowHeight;
        }
    }

    pages.forEach((pageRows, pageIndex) => {
        if (pageIndex > 0) doc.addPage();
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text(fitPdfText(doc, `${locationName || 'Venue'} - ${headerLabel}`, contentWidth), margin, titleY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`Monthly agenda${pageIndex > 0 ? ' - continued' : ''}`, margin, subtitleY);

        let rowY = gridY;
        pageRows.forEach((row) => {
            const week = monthGrid.slice(row.weekIndex * 7, row.weekIndex * 7 + 7);
            for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                const cell = week[dayIndex];
                const x = margin + dayIndex * cellWidth;
                const isWeekend = dayIndex >= 5;
                doc.setFillColor(
                    cell.isCurrentMonth ? (isWeekend ? 250 : 255) : 241,
                    cell.isCurrentMonth ? (isWeekend ? 251 : 255) : 245,
                    cell.isCurrentMonth ? (isWeekend ? 252 : 255) : 249
                );
                doc.setDrawColor(203, 213, 225);
                doc.rect(x, rowY, cellWidth, row.height, 'FD');

                const today = toLocalDateString(cell.date) === toLocalDateString(new Date());
                const dayLabel = `${dayNames[dayIndex].slice(0, 3)} ${cell.date.getDate()}`;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(
                    today ? accent[0] : cell.isCurrentMonth ? 30 : 148,
                    today ? accent[1] : cell.isCurrentMonth ? 41 : 163,
                    today ? accent[2] : cell.isCurrentMonth ? 59 : 184
                );
                doc.text(dayLabel, x + 2, rowY + 5.1);

                const dayBookings = getBookingsForDay(cell.date);
                const visibleBookings = dayBookings.slice(row.start, row.start + row.count);
                let eventY = rowY + dayHeaderHeight;
                for (const booking of visibleBookings) {
                    const time = `${String(booking.startHour).padStart(2, '0')}:${String(booking.startMinute).padStart(2, '0')}`;
                    const label = `${time}  ${booking.title}`;
                    doc.setFillColor(...lightAccent);
                    doc.setDrawColor(...lightAccent);
                    doc.roundedRect(x + 1, eventY, cellWidth - 2, eventLineHeight - eventGap, 1, 1, 'FD');
                    doc.setFillColor(...accent);
                    doc.rect(x + 1, eventY, 0.8, eventLineHeight - eventGap, 'F');
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(fontSize);
                    doc.setTextColor(30, 41, 59);
                    doc.text(fitPdfText(doc, label, cellWidth - 5), x + 2.5, eventY + 5.2);
                    eventY += eventLineHeight;
                }
            }
            rowY += row.height;
        });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`Page ${pageIndex + 1} of ${pages.length}`, pageWidth - margin, pageHeight - 3, { align: 'right' });
    });

    doc.save(`calendar-${headerLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
}

function exportWeeklyAgendaPdf(options: AgendaPdfOptions): void {
    const {
        headerLabel, locationName, activeColor, weekDays, getBookingsForDay, getRenterLabel,
        startHourGrid, endHourGrid
    } = options;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 8;
    const contentWidth = pageWidth - margin * 2;
    const titleY = margin + 6;
    const subtitleY = margin + 11;
    const dayHeaderY = margin + 16;
    const dayHeaderHeight = 10;
    const gridTop = dayHeaderY + dayHeaderHeight;
    const gridBottom = pageHeight - margin - 8;
    const gridHeight = gridBottom - gridTop;
    const timeColumnWidth = 15;
    const hourCount = startHourGrid <= endHourGrid
        ? endHourGrid - startHourGrid
        : 24 - startHourGrid + endHourGrid;
    const minutesInGrid = hourCount * 60;
    const { accent, lightAccent } = getAccentColor(activeColor);
    const dayGroups = [[0, 1, 2, 3], [4, 5, 6]];
    const totalPages = dayGroups.length;
    const hourToOffset = (hour: number, minute: number): number => {
        let offset = hour * 60 + minute - startHourGrid * 60;
        if (offset < 0) offset += 24 * 60;
        return offset;
    };

    dayGroups.forEach((dayIndexes, pageIndex) => {
        if (pageIndex > 0) doc.addPage();
        const columnWidth = (contentWidth - timeColumnWidth) / dayIndexes.length;
        const gridX = margin + timeColumnWidth;

        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text(fitPdfText(doc, `${locationName || 'Venue'} - Week of ${headerLabel}`, contentWidth), margin, titleY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`Weekly agenda${pageIndex > 0 ? ' - continued' : ''}`, margin, subtitleY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        dayIndexes.forEach((dayIndex, columnIndex) => {
            const day = weekDays[dayIndex];
            const x = gridX + columnIndex * columnWidth;
            const label = day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(203, 213, 225);
            doc.rect(x, dayHeaderY, columnWidth, dayHeaderHeight, 'FD');
            doc.setTextColor(30, 41, 59);
            doc.text(fitPdfText(doc, label, columnWidth - 4), x + 2, dayHeaderY + 6.5);
        });

        for (let hourIndex = 0; hourIndex < hourCount; hourIndex++) {
            const hour = (startHourGrid + hourIndex) % 24;
            const y = gridTop + hourIndex * (gridHeight / hourCount);
            const hourLabel = `${String(hour).padStart(2, '0')}:00`;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105);
            doc.text(hourLabel, margin, y + 2.8);
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.2);
            doc.line(gridX, y, pageWidth - margin, y);
            doc.setDrawColor(226, 232, 240);
            dayIndexes.forEach((_, columnIndex) => {
                const x = gridX + columnIndex * columnWidth;
                doc.line(x, y, x, gridBottom);
            });
        }
        doc.setDrawColor(203, 213, 225);
        doc.line(gridX, gridBottom, pageWidth - margin, gridBottom);
        doc.line(pageWidth - margin, gridTop, pageWidth - margin, gridBottom);

        dayIndexes.forEach((dayIndex, columnIndex) => {
            const day = weekDays[dayIndex];
            const x = gridX + columnIndex * columnWidth;
            const dayBookings = getBookingsForDay(day);
            for (const booking of dayBookings) {
                const startOffset = hourToOffset(booking.startHour, booking.startMinute);
                let endOffset = hourToOffset(booking.endHour, booking.endMinute);
                if (endOffset <= startOffset) endOffset += 24 * 60;
                const clippedStart = Math.max(0, startOffset);
                const clippedEnd = Math.min(minutesInGrid, endOffset);
                if (clippedEnd <= clippedStart) continue;

                const top = gridTop + (clippedStart / minutesInGrid) * gridHeight;
                const height = Math.max(2.5, ((clippedEnd - clippedStart) / minutesInGrid) * gridHeight);
                const cardX = x + 1;
                const cardWidth = columnWidth - 2;
                doc.setFillColor(...lightAccent);
                doc.setDrawColor(...accent);
                doc.setLineWidth(0.35);
                doc.roundedRect(cardX, top, cardWidth, height, 1, 1, 'FD');
                doc.setFillColor(...accent);
                doc.rect(cardX, top, 1, height, 'F');

                const startTime = `${String(booking.startHour).padStart(2, '0')}:${String(booking.startMinute).padStart(2, '0')}`;
                const endTime = `${String(booking.endHour).padStart(2, '0')}:${String(booking.endMinute).padStart(2, '0')}`;
                const timeLabel = `${startTime} - ${endTime}`;
                const renterLabel = `${getRenterLabel(booking)}${booking.recurrence === 'weekly' ? ' (weekly)' : ''}`;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(30, 41, 59);
                if (height >= 12) {
                    doc.text(fitPdfText(doc, timeLabel, cardWidth - 5), cardX + 3, top + 3.2);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(9);
                    doc.text(fitPdfText(doc, booking.title, cardWidth - 5), cardX + 3, top + 6.5);
                    doc.setFontSize(8);
                    doc.setTextColor(71, 85, 105);
                    doc.text(fitPdfText(doc, renterLabel, cardWidth - 5), cardX + 3, top + 9.8);
                } else if (height >= 8) {
                    doc.text(fitPdfText(doc, timeLabel, cardWidth - 5), cardX + 3, top + 3.2);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(9);
                    doc.text(fitPdfText(doc, booking.title, cardWidth - 5), cardX + 3, top + 6.5);
                } else if (height >= 4.2) {
                    doc.text(fitPdfText(doc, `${startTime} ${booking.title}`, cardWidth - 5), cardX + 3, top + Math.min(height - 0.7, 3));
                } else {
                    doc.setFontSize(8);
                    doc.text(fitPdfText(doc, `${startTime} ${booking.title}`, cardWidth - 5), cardX + 3, top + 2.8);
                }
            }
        });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`Page ${pageIndex + 1} of ${totalPages}`, pageWidth - margin, pageHeight - 3, { align: 'right' });
    });

    doc.save(`calendar-${headerLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
}

export function downloadAgendaPdf(options: AgendaPdfOptions): void {
    if (options.viewMode === 'month') {
        exportMonthlyAgendaPdf(options);
        return;
    }
    exportWeeklyAgendaPdf(options);
}
