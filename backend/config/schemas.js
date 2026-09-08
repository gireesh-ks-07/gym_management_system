/**
 * Request validation.
 *
 * Joi was a dependency with exactly one schema — staff login — while the other
 * 107 routes destructured req.body and trusted it. That meant numeric fields
 * accepted strings, dates accepted anything `new Date()` would swallow (storing
 * Invalid Date), no string had a length bound, and a missing required field
 * surfaced as a 500 from the database rather than a 400 naming the field.
 *
 * These cover the routes that handle money, identity and credentials. The rest
 * can follow; the `validate()` middleware makes each one a single line:
 *
 *     app.post('/api/payments', [...auth, validate(S.recordPayment)], handler)
 */
const Joi = require('joi');

// Indian mobile numbers as the app already treats them: exactly ten digits.
const phone = Joi.string().pattern(/^\d{10}$/).messages({
    'string.pattern.base': 'Phone number must be exactly 10 digits'
});

// Matches the minimum the staff password reset already enforced; the member
// path had none at all.
const password = Joi.string().min(6).max(128);

// Structure only — local@domain.tld — with the TLD registry check off.
//
// Joi's default email() validates the TLD against the IANA list, which rejects
// reserved test domains (RFC 2606: .test, .example, .invalid, .localhost) and
// any TLD newer than the bundled list. That made 22 of the 23 seeded members
// unsaveable: editing anyone on a @….test address failed with `"email" must be
// a valid email` before a single field was written. This application is not the
// DNS registry; deliverability is not something a form can establish anyway.
const email = Joi.string().email({ tlds: { allow: false } });

const money = Joi.number().positive().precision(2).max(10000000);
const id = Joi.number().integer().positive();
// Optional foreign key coming from a form. An unselected <select> submits '',
// which Joi's number conversion rejects — adding a member with no plan chosen
// failed with `"planId" must be a number`. `.empty('')` reads '' as "not
// provided" so the field is simply absent.
const optionalId = Joi.number().integer().positive().allow(null).empty('');
const dateish = Joi.date();

const schemas = {
    // --- Credentials ---
    login: Joi.object({
        email: email.required(),
        password: Joi.string().min(1).required()
    }),

    clientLogin: Joi.object({
        email,
        phone,
        password: Joi.string().min(1).required()
    }).or('email', 'phone'),

    resetPassword: Joi.object({
        newPassword: password.required()
    }),

    // --- Identity ---
    createClient: Joi.object({
        name: Joi.string().trim().min(1).max(120).required(),
        phone: phone.required(),
        email: email.allow('', null),
        gender: Joi.string().valid('male', 'female', 'other').required(),
        height: Joi.number().positive().max(300).allow(null),
        weight: Joi.number().positive().max(500).allow(null),
        joiningDate: dateish.allow(null),
        billingRenewalDate: dateish.allow(null),
        planId: optionalId,
        // Seat this member on an existing membership (the second half of a
        // couple, a third family member). Capacity is enforced server-side.
        membershipId: optionalId,
        aadhaar_number: Joi.string().pattern(/^\d{12}$/).allow('', null)
            .messages({ 'string.pattern.base': 'Aadhaar number must be 12 digits' }),
        address: Joi.string().max(500).allow('', null),
        // Free-form by design — sanitised separately by sanitizeHealthProfile.
        customFields: Joi.object().unknown(true),
        healthProfile: Joi.object().unknown(true),
        workoutPlans: Joi.array()
    }).unknown(false),

    updateClient: Joi.object({
        name: Joi.string().trim().min(1).max(120),
        phone,
        email: email.allow('', null),
        gender: Joi.string().valid('male', 'female', 'other'),
        height: Joi.number().positive().max(300).allow(null),
        weight: Joi.number().positive().max(500).allow(null),
        joiningDate: dateish.allow(null),
        billingRenewalDate: dateish.allow(null),
        planId: optionalId,
        aadhaar_number: Joi.string().pattern(/^\d{12}$/).allow('', null),
        address: Joi.string().max(500).allow('', null),
        customFields: Joi.object().unknown(true),
        healthProfile: Joi.object().unknown(true),
        workoutPlans: Joi.array(),
        status: Joi.string().valid('active', 'inactive', 'payment_due')
    }).unknown(false),

    createStaff: Joi.object({
        name: Joi.string().trim().min(1).max(120).required(),
        email: email.required(),
        password: password.required(),
        role: Joi.string().valid('staff', 'dietician'),
        phone: phone.allow('', null),
        // Dietician credentials, printed on the diet-chart PDF header. The edit
        // path has always accepted these; leaving them off here rejected the
        // Add Staff form outright with '"qualification" is not allowed'.
        qualification: Joi.string().trim().max(120).allow('', null),
        registrationNumber: Joi.string().trim().max(120).allow('', null)
    }).unknown(false),

    // --- Money ---
    recordPayment: Joi.object({
        clientId: id.required(),
        amount: money.required(),
        method: Joi.string().valid('cash', 'upi').required(),
        date: dateish.allow(null),
        transactionId: Joi.string().max(120).allow('', null)
    }).unknown(false),

    createPlan: Joi.object({
        name: Joi.string().trim().min(1).max(120).required(),
        price: Joi.number().min(0).precision(2).required(),
        duration: Joi.number().integer().min(1).max(120).required(),
        description: Joi.string().max(500).allow('', null),
        features: Joi.array().items(Joi.string().max(200)),
        planType: Joi.string().valid('normal', 'pt'),
        ptSessionsCount: Joi.number().integer().min(1).max(500).allow(null, ''),
        ptSessionPeriod: Joi.string().valid('weekly', 'monthly').allow(null, ''),
        // How many people one membership of this plan covers. 1 is individual.
        // The upper bound is a sanity limit, not a business rule — a family or
        // corporate plan of 20 is plausible, 500 is a typo.
        memberCapacity: Joi.number().integer().min(1).max(20).allow(null, '')
    }).unknown(false)
};

/**
 * Express middleware. Reports every problem at once rather than one per
 * round trip, and strips unknown keys so a client cannot smuggle a field the
 * handler forgot to pick out of req.body.
 */
const validate = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
    });
    if (error) {
        return res.status(400).json({
            message: error.details[0].message,
            errors: error.details.map((d) => ({ field: d.path.join('.'), message: d.message }))
        });
    }
    req.body = value;
    next();
};

module.exports = { S: schemas, schemas, validate };
