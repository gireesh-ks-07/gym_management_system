const PDFDocument = require('pdfkit');

// ============================================================================
// Diet chart -> PDF
//
// Renders a DietChart as the clinical hand-out a dietician gives the member:
// a letterheaded A4 document whose centre is the "Diet Specification" table
// (Time | Diet specification | Remarks), bracketed by the assessment summary
// above and the guidelines / follow-up / signature below.
//
// Only the sections that carry content are printed. A chart with nothing but a
// meal plan produces a short, valid document rather than a page of empty
// headings — dieticians fill these in over several sittings, and a half-filled
// assessment is the normal state, not an error.
// ============================================================================

const PAGE = { size: 'A4', margins: { top: 92, bottom: 78, left: 48, right: 48 } };
const INK = '#111111';
const MUTED = '#555555';
const RULE = '#999999';

const FONT = 'Helvetica';
const BOLD = 'Helvetica-Bold';
const ITALIC = 'Helvetica-Oblique';

// ── small helpers ───────────────────────────────────────────────────────────

const txt = (v) => (v == null ? '' : String(v).trim());
const has = (v) => txt(v) !== '';

// "a / b / c" from whichever parts are present.
const join = (parts, sep = '   ') => parts.filter(has).join(sep);

// A labelled value, or null when the value is empty.
const pair = (label, value, unit = '') => (has(value) ? `${label}: ${txt(value)}${unit}` : null);

const fmtDate = (d) => {
    if (!has(d)) return '';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return txt(d);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${String(dt.getFullYear()).slice(-2)}`;
};

const GOAL_LABELS = {
    weight_loss: 'Weight loss', weight_gain: 'Weight gain', maintenance: 'Maintenance',
    muscle_gain: 'Muscle gain', performance: 'Performance', therapeutic: 'Therapeutic'
};

// ── meal plan -> table rows ─────────────────────────────────────────────────

// One meal becomes one table row. A meal's options are alternatives, so they are
// separated by "OR" the way a dietician writes them by hand; the items inside an
// option are a combination and each gets its own line.
//
// Returns { time, body: [{text, bold}], remarks } — body is a segment list
// rather than a string because the meal type is bold and the items are not.
const mealRows = (mealPlan) => {
    const rows = [];
    for (const meal of Array.isArray(mealPlan) ? mealPlan : []) {
        const options = Array.isArray(meal.options) ? meal.options : [];
        const body = [];
        const notes = [];

        if (has(meal.mealType)) body.push({ text: `${txt(meal.mealType)}:`, bold: true });

        options.forEach((opt, oi) => {
            const items = (Array.isArray(opt.items) ? opt.items : [])
                .map((it) => {
                    const macros = join([
                        has(it.calories) ? `${txt(it.calories)} kcal` : null,
                        has(it.protein) ? `${txt(it.protein)} g protein` : null
                    ], ', ');
                    return has(it.food) ? (macros ? `${txt(it.food)}  (${macros})` : txt(it.food)) : null;
                })
                .filter(Boolean);

            if (!items.length && !has(opt.note)) return;
            if (oi > 0 && (items.length || has(opt.note))) body.push({ text: 'OR', bold: true, muted: true });
            items.forEach((line) => body.push({ text: line }));
            if (has(opt.note)) notes.push(txt(opt.note));
        });

        // A row with a time but nothing in it is an unfinished draft line; drop it.
        if (!body.length && !has(meal.time)) continue;
        rows.push({ time: txt(meal.time), body, remarks: notes.join('\n') });
    }
    return rows;
};

// ── letterhead ──────────────────────────────────────────────────────────────

// Painted on every page after the body is laid out (bufferPages), so that the
// last page gets its footer too and the header never pushes the body around.
const paintLetterhead = (doc, { practitioner, facility }) => {
    const range = doc.bufferedPageRange();
    const left = PAGE.margins.left;
    const width = doc.page.width - PAGE.margins.left - PAGE.margins.right;

    for (let i = range.start; i < range.start + range.count; i += 1) {
        doc.switchToPage(i);

        // The header and footer deliberately sit outside the text margins. PDFKit
        // auto-paginates whenever text crosses the bottom margin, so painting the
        // footer would spawn a fresh page per page — which is exactly what it did
        // before this: a 2-page chart came out as 6. Zero the margins for the
        // duration of the paint and restore them afterwards.
        const saved = { ...doc.page.margins };
        doc.page.margins.top = 0;
        doc.page.margins.bottom = 0;

        // --- header ---
        // Charts authored before a facility employed a dietician carry no
        // practitioner, and admins may author them directly. Fall back to the
        // facility so the document is never issued anonymously.
        let y = 34;
        const headerName = has(practitioner.name) ? practitioner.name : txt(facility.name);
        if (has(headerName)) {
            doc.font(BOLD).fontSize(10.5).fillColor(INK)
                .text(headerName, left, y, { width, align: 'center' });
            y = doc.y + 1;
        }
        const credentials = join([practitioner.qualification,
            has(practitioner.registrationNumber) ? `Reg No. ${practitioner.registrationNumber}` : null], '   ');
        if (credentials) {
            doc.font(FONT).fontSize(8.5).fillColor(MUTED)
                .text(credentials, left, y, { width, align: 'center' });
            y = doc.y;
        }
        doc.moveTo(left, PAGE.margins.top - 18).lineTo(left + width, PAGE.margins.top - 18)
            .lineWidth(0.75).strokeColor(RULE).stroke();

        // --- footer ---
        const fy = doc.page.height - PAGE.margins.bottom + 16;
        doc.moveTo(left, fy - 10).lineTo(left + width, fy - 10)
            .lineWidth(0.75).strokeColor(RULE).stroke();

        let l1 = facility.name || '';
        if (has(facility.tagline)) l1 = join([l1, `'${txt(facility.tagline)}'`], '  —  ');
        const l2 = join([facility.address,
            facility.email,
            has(facility.phone) ? `PH: ${txt(facility.phone)}` : null], '   |   ');

        doc.font(BOLD).fontSize(8).fillColor(MUTED).text(l1, left, fy, { width, align: 'center' });
        if (l2) doc.font(FONT).fontSize(7.5).fillColor(MUTED).text(l2, left, doc.y + 1, { width, align: 'center' });

        doc.font(FONT).fontSize(7.5).fillColor(MUTED)
            .text(`Page ${i - range.start + 1} of ${range.count}`,
                left, doc.page.height - PAGE.margins.bottom + 44, { width, align: 'right' });

        doc.page.margins = saved;
    }
};

// ── layout primitives ───────────────────────────────────────────────────────

const bottomLimit = (doc) => doc.page.height - PAGE.margins.bottom;

// Reserve vertical space, breaking the page when the block will not fit.
const ensure = (doc, height) => {
    if (doc.y + height > bottomLimit(doc)) {
        doc.addPage();
        doc.y = PAGE.margins.top;
    }
};

const contentWidth = (doc) => doc.page.width - PAGE.margins.left - PAGE.margins.right;

const heading = (doc, label) => {
    ensure(doc, 34);
    doc.moveDown(0.55);
    doc.font(BOLD).fontSize(10).fillColor(INK)
        .text(label.toUpperCase(), PAGE.margins.left, doc.y, { width: contentWidth(doc), characterSpacing: 0.4 });
    const y = doc.y + 2;
    doc.moveTo(PAGE.margins.left, y).lineTo(PAGE.margins.left + contentWidth(doc), y)
        .lineWidth(0.5).strokeColor(RULE).stroke();
    doc.y = y + 5;
};

// A "Label: value" line list, two per row where they are short enough to pair.
const facts = (doc, lines) => {
    const present = lines.filter(Boolean);
    if (!present.length) return;
    doc.font(FONT).fontSize(9).fillColor(INK);
    for (const line of present) {
        const h = doc.heightOfString(line, { width: contentWidth(doc) });
        ensure(doc, h + 2);
        doc.text(line, PAGE.margins.left, doc.y, { width: contentWidth(doc) });
        doc.y += 1.5;
    }
};

const bullets = (doc, items) => {
    const present = (items || []).map(txt).filter(has);
    if (!present.length) return;
    doc.font(FONT).fontSize(9).fillColor(INK);
    for (const item of present) {
        const w = contentWidth(doc) - 14;
        const h = doc.heightOfString(item, { width: w });
        ensure(doc, h + 3);
        const y = doc.y;
        doc.text('•', PAGE.margins.left + 2, y, { width: 10 });
        doc.text(item, PAGE.margins.left + 14, y, { width: w });
        doc.y += 2;
    }
};

// ── the diet specification table ────────────────────────────────────────────

const COLS = { time: 62, remarks: 116 }; // "diet specification" takes the rest.

const tableHeader = (doc) => {
    const left = PAGE.margins.left;
    const w = contentWidth(doc);
    const midW = w - COLS.time - COLS.remarks;
    const y = doc.y;

    doc.rect(left, y, w, 18).fillColor('#f0f0f0').fill();
    doc.font(BOLD).fontSize(8.5).fillColor(INK);
    doc.text('Time', left + 5, y + 5, { width: COLS.time - 8 });
    doc.text('Diet specification', left + COLS.time + 5, y + 5, { width: midW - 8 });
    doc.text('Remarks', left + COLS.time + midW + 5, y + 5, { width: COLS.remarks - 8 });
    doc.y = y + 18;
    doc.moveTo(left, doc.y).lineTo(left + w, doc.y).lineWidth(0.5).strokeColor(RULE).stroke();
};

const dietTable = (doc, rows) => {
    if (!rows.length) return;
    const left = PAGE.margins.left;
    const w = contentWidth(doc);
    const midW = w - COLS.time - COLS.remarks;

    ensure(doc, 60);
    tableHeader(doc);

    for (const row of rows) {
        // Measure the tallest cell before committing to a page.
        doc.font(FONT).fontSize(9);
        const timeH = doc.heightOfString(row.time || '', { width: COLS.time - 10 });
        const remarksH = doc.heightOfString(row.remarks || '', { width: COLS.remarks - 10 });
        let bodyH = 0;
        for (const seg of row.body) {
            doc.font(seg.bold ? BOLD : FONT).fontSize(9);
            bodyH += doc.heightOfString(seg.text, { width: midW - 10 }) + 1;
        }
        const rowH = Math.max(timeH, bodyH, remarksH) + 10;

        // A row taller than a whole page cannot be kept together; let it start
        // on a fresh page and overflow rather than looping forever.
        if (doc.y + rowH > bottomLimit(doc)) {
            doc.addPage();
            doc.y = PAGE.margins.top;
            tableHeader(doc);
        }

        const top = doc.y;
        doc.font(FONT).fontSize(9).fillColor(INK);
        if (has(row.time)) doc.text(row.time, left + 5, top + 5, { width: COLS.time - 10 });
        if (has(row.remarks)) doc.text(row.remarks, left + COLS.time + midW + 5, top + 5, { width: COLS.remarks - 10 });

        let by = top + 5;
        for (const seg of row.body) {
            doc.font(seg.bold ? BOLD : FONT).fontSize(9).fillColor(seg.muted ? MUTED : INK);
            doc.text(seg.text, left + COLS.time + 5, by, { width: midW - 10 });
            by = doc.y + 1;
        }

        doc.y = top + rowH;
        doc.moveTo(left, doc.y).lineTo(left + w, doc.y).lineWidth(0.4).strokeColor('#cccccc').stroke();
    }

    // Column separators, drawn per page span would require tracking; a single
    // outer rule keeps the table readable without mis-drawing across breaks.
    doc.y += 2;
};

// ── document ────────────────────────────────────────────────────────────────

/**
 * Build the PDF for one diet chart.
 *
 * @param {object} chart    DietChart instance (plain or Sequelize), including
 *                          its Client and `dietician` User.
 * @param {object} facility Facility providing the footer letterhead.
 * @returns {Promise<Buffer>}
 */
function buildDietChartPdf(chart, facility) {
    const d = chart.data || {};
    const pi = d.personalInfo || {};
    const mh = d.medicalHistory || {};
    const dp = d.dietaryPreferences || {};
    const act = d.activitySummary || {};
    const ms = d.mealSpec || {};
    const ng = d.nutritionGoals || {};
    const client = chart.Client || {};
    const dietician = chart.dietician || {};

    const practitioner = {
        name: txt(dietician.name),
        qualification: txt(dietician.qualification),
        registrationNumber: txt(dietician.registrationNumber)
    };

    const doc = new PDFDocument({ ...PAGE, bufferPages: true, autoFirstPage: false, info: {
        Title: txt(chart.title) || 'Diet Chart',
        Author: practitioner.name || txt(facility.name),
        Subject: `Diet chart for ${txt(client.name)}`
    } });

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    const done = new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });

    doc.addPage();
    doc.y = PAGE.margins.top;

    // --- title ---
    doc.font(BOLD).fontSize(13).fillColor(INK)
        .text(txt(chart.title) || 'Diet Chart', PAGE.margins.left, doc.y, { width: contentWidth(doc), align: 'center' });
    doc.moveDown(0.3);

    // --- 1. personal information ---
    heading(doc, 'Personal Information');
    facts(doc, [
        join([pair('Name', has(pi.name) ? pi.name : client.name),
              pair('Age', pi.age, ' yrs'),
              pair('Gender', pi.gender)], '        '),
        join([pair('Date', fmtDate(chart.assessmentDate || chart.createdAt)),
              pair('Contact', has(pi.contact) ? pi.contact : client.phone),
              pair('Occupation', pi.occupation)], '        '),
        pair('Goal', GOAL_LABELS[chart.primaryGoal] || chart.primaryGoal)
    ]);

    // --- anthropometric ---
    const anthro = join([
        pair('Height', has(pi.height) ? pi.height : client.height, ' cm'),
        pair('Weight', has(pi.weight) ? pi.weight : client.weight, ' kg'),
        pair('BMI', pi.bmi, ' kg/m2'),
        pair('Waist', pi.waist, ' cm'),
        pair('Hip', pi.hip, ' cm')
    ], '        ');
    if (anthro) {
        heading(doc, 'Anthropometric Data');
        facts(doc, [anthro]);
    }

    // --- clinical summary ---
    const bodyComp = (d.bodyComposition || [])
        .filter((r) => has(r.parameter) && has(r.current))
        .map((r) => `${txt(r.parameter)}: ${txt(r.current)}${has(r.reference) ? ` (goal ${txt(r.reference)})` : ''}`)
        .join(',   ');

    const summary = [
        pair('Present complaints', mh.present),
        pair('Previous history', mh.previous),
        pair('Digestive / GI', mh.giComplaints),
        pair('Food preference', join([dp.dietType, dp.likes], ' / ')),
        pair('Allergies / intolerances', dp.allergies),
        pair('Foods avoided', join([dp.avoided, dp.restrictions], ' / ')),
        pair('Body composition analysis', bodyComp || d.bodyCompositionNotes),
        pair('Workout pattern', join([act.averageDaily, act.workoutGoal], ' — ')),
        pair('Sleep / stress', join([mh.sleep, mh.stress], ' / '))
    ].filter(Boolean);
    if (summary.length) {
        heading(doc, 'Assessment Summary');
        facts(doc, summary);
    }

    // --- nutrition goals ---
    const goals = [
        pair('Primary goal', ng.primary),
        join([pair('Target weight', ng.targetWeight, ' kg'),
              pair('Target body fat', ng.targetBodyFat, ' %'),
              pair('Target protein', ng.targetProtein, ' g/day'),
              pair('Target water', ng.targetWater, ' L/day')], '        '),
        pair('Activity target', ng.activityTarget),
        ...[ng.secondary1, ng.secondary2, ng.secondary3].filter(has).map((g) => `•  ${txt(g)}`)
    ].filter((x) => has(x));
    if (goals.length) {
        heading(doc, 'Nutrition Goals');
        facts(doc, goals);
    }

    // --- 12. the diet plan itself ---
    const rows = mealRows(d.mealPlan);
    if (rows.length) {
        heading(doc, 'Diet Specification');
        dietTable(doc, rows);

        const spec = join([
            pair('Estimated average calorie', ms.calories, ' kcal'),
            pair('Protein', ms.protein, ' g'),
            pair('Carbohydrate', ms.carbs, ' g'),
            pair('Fat', ms.fat, ' g'),
            pair('Fiber', ms.fiber, ' g'),
            pair('Fluid', ms.water, ' L/day')
        ], '        ');
        if (spec) {
            doc.moveDown(0.4);
            facts(doc, [spec]);
        }
    }

    // --- 13. guidelines ---
    const food = (d.guidelines?.food || []).filter(has);
    const lifestyle = (d.guidelines?.lifestyle || []).filter(has);
    if (food.length || lifestyle.length) {
        heading(doc, 'General Guidelines');
        if (food.length) {
            doc.font(BOLD).fontSize(9).fillColor(INK).text('Food', PAGE.margins.left, doc.y);
            doc.y += 2;
            bullets(doc, food);
        }
        if (lifestyle.length) {
            doc.moveDown(0.25);
            doc.font(BOLD).fontSize(9).fillColor(INK).text('Lifestyle', PAGE.margins.left, doc.y);
            doc.y += 2;
            bullets(doc, lifestyle);
        }
    }

    // --- 14. follow-up ---
    const followUp = [
        pair('Next follow-up', fmtDate(d.nextFollowUpDate)),
        pair('Remarks', d.dietitianRemarks)
    ].filter(Boolean);
    if (followUp.length) {
        heading(doc, 'Follow-up & Monitoring');
        facts(doc, followUp);
    }

    // --- signature ---
    if (practitioner.name) {
        ensure(doc, 62);
        doc.moveDown(2);
        const sx = doc.page.width - PAGE.margins.right - 190;
        doc.font(BOLD).fontSize(9.5).fillColor(INK).text(practitioner.name, sx, doc.y, { width: 190, align: 'right' });
        if (has(practitioner.qualification)) {
            doc.font(ITALIC).fontSize(8).fillColor(MUTED)
                .text(practitioner.qualification, sx, doc.y + 1, { width: 190, align: 'right' });
        }
    }

    paintLetterhead(doc, { practitioner, facility: facility || {} });
    doc.end();
    return done;
}

// A filesystem-safe download name: "Mr Varun Kandoth - Initial Assessment.pdf".
function pdfFilename(chart) {
    const parts = [txt(chart.Client?.name), txt(chart.title)].filter(has);
    const base = (parts.join(' - ') || 'diet-chart').replace(/[^\w\s.-]/g, '').replace(/\s+/g, ' ').trim();
    return `${base}.pdf`;
}

module.exports = { buildDietChartPdf, pdfFilename };
