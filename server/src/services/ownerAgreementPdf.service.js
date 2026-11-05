const https = require('https');
const http = require('http');
const ApiError = require('../utils/ApiError');
const siteContentService = require('./siteContent.service');
const OwnerOnboarding = require('../models/OwnerOnboarding');

const MARGIN = 48;
const PAGE = { width: 595.28, height: 841.89 }; // A4 points
const BRAND = '#1B5E3B';
const INK = '#1A1A1A';
const MUTED = '#555555';
const RULE = '#C8D5CC';
const PAPER = '#FFFEFA';

function pickLocale(field, lang = 'so', fallback = '') {
  if (field == null) return fallback;
  if (typeof field === 'string') {
    const s = field.trim();
    return s || fallback;
  }
  if (typeof field !== 'object') return fallback;
  const order = [lang, 'so', 'en', 'ar'];
  for (const code of order) {
    const v = field[code];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return fallback;
}

function formatDate(d) {
  if (!d) return '____________________';
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return '____________________';
  }
}

function fetchBuffer(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (!url || !/^https?:\/\//i.test(url)) {
      resolve(null);
      return;
    }
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchBuffer(res.headers.location, timeoutMs).then(resolve);
        res.resume();
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        resolve(null);
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

function drawHeader(doc, { subtitle }) {
  const top = MARGIN;
  doc.save();
  doc.rect(0, 0, PAGE.width, 72).fill(BRAND);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18);
  doc.text('E-GAROON', MARGIN, top + 10, { continued: false });
  doc.font('Helvetica').fontSize(9).fillColor('#D4E8DC');
  doc.text('Stadium booking platform · Somalia', MARGIN, top + 34);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#FFFFFF');
  doc.text(subtitle, MARGIN, top + 48, {
    width: PAGE.width - MARGIN * 2,
    align: 'right',
  });
  doc.restore();
  doc.y = 88;
}

function drawFooter(doc) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    const pageNo = i + 1;
    const y = PAGE.height - 36;
    doc.save();
    doc.strokeColor(RULE).lineWidth(0.6);
    doc.moveTo(MARGIN, y - 8).lineTo(PAGE.width - MARGIN, y - 8).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    doc.text('E-Garoon · Owner onboarding agreement', MARGIN, y, {
      width: PAGE.width / 2 - MARGIN,
      align: 'left',
      lineBreak: false,
    });
    doc.text(`Page ${pageNo} of ${range.count}`, PAGE.width / 2, y, {
      width: PAGE.width / 2 - MARGIN,
      align: 'right',
      lineBreak: false,
    });
    doc.restore();
  }
}

function ensureSpace(doc, needed) {
  if (doc.y + needed > PAGE.height - 56) {
    doc.addPage();
    doc.y = MARGIN;
  }
}

function sectionTitle(doc, title) {
  ensureSpace(doc, 28);
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND).text(title);
  doc
    .strokeColor(RULE)
    .lineWidth(1)
    .moveTo(MARGIN, doc.y + 2)
    .lineTo(PAGE.width - MARGIN, doc.y + 2)
    .stroke();
  doc.moveDown(0.55);
  doc.fillColor(INK);
}

function bodyParagraphs(doc, text) {
  const cleaned = String(text || '').trim() || '(No agreement text configured in Site Content yet.)';
  const blocks = cleaned.split(/\n{2,}/);
  doc.font('Helvetica').fontSize(9.5).fillColor(INK).lineGap(2.5);
  for (const block of blocks) {
    ensureSpace(doc, 40);
    doc.text(block.trim(), {
      width: PAGE.width - MARGIN * 2,
      align: 'left',
      paragraphGap: 6,
    });
    doc.moveDown(0.35);
  }
}

function kvRow(doc, label, value) {
  ensureSpace(doc, 16);
  const x = MARGIN;
  const labelW = 130;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text(label, x, doc.y, {
    width: labelW,
    continued: false,
    lineBreak: false,
  });
  const y = doc.y;
  doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(value || '—', x + labelW, y, {
    width: PAGE.width - MARGIN * 2 - labelW,
  });
  doc.moveDown(0.15);
}

function paintSignaturePair(doc, left, right) {
  ensureSpace(doc, 130);
  const startY = doc.y;
  const gap = 16;
  const boxW = (PAGE.width - MARGIN * 2 - gap) / 2;
  const boxH = 118;

  const paintOne = (x, data) => {
    doc.save();
    doc.roundedRect(x, startY, boxW, boxH, 4).strokeColor(RULE).lineWidth(1).stroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND);
    doc.text(data.title, x + 10, startY + 8, { width: boxW - 20 });

    const sigTop = startY + 24;
    const sigH = 42;
    if (data.imageBuffer) {
      try {
        doc.image(data.imageBuffer, x + 12, sigTop, {
          fit: [boxW - 24, sigH],
          align: 'left',
          valign: 'center',
        });
      } catch {
        doc
          .strokeColor('#999')
          .dash(3, { space: 2 })
          .moveTo(x + 12, sigTop + sigH - 4)
          .lineTo(x + boxW - 12, sigTop + sigH - 4)
          .stroke()
          .undash();
      }
    } else {
      doc
        .strokeColor('#999')
        .dash(3, { space: 2 })
        .moveTo(x + 12, sigTop + sigH - 4)
        .lineTo(x + boxW - 12, sigTop + sigH - 4)
        .stroke()
        .undash();
      doc.font('Helvetica').fontSize(8).fillColor(MUTED);
      doc.text('Signature', x + 12, sigTop + 12, { width: boxW - 24 });
    }

    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    doc.text(`${data.nameLabel}:`, x + 10, startY + 72, { width: boxW - 20 });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(INK);
    doc.text(data.nameValue || '____________________', x + 10, startY + 84, {
      width: boxW - 20,
    });
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    doc.text(`Date: ${data.dateValue || '____________________'}`, x + 10, startY + 100, {
      width: boxW - 20,
    });
    doc.restore();
  };

  paintOne(MARGIN, left);
  paintOne(MARGIN + boxW + gap, right);
  doc.y = startY + boxH + 12;
}

/**
 * Build agreement PDF buffer.
 * @param {object} opts
 * @param {'template'|'filled'} opts.mode
 * @param {'so'|'en'} [opts.lang]
 * @param {object} [opts.onboarding] lean/public onboarding doc for filled mode
 */
async function buildAgreementPdf(opts = {}) {
  let PDFDocument;
  try {
    PDFDocument = require('pdfkit');
  } catch {
    throw ApiError.badRequest('PDF export requires pdfkit — run npm install pdfkit in server/');
  }

  const lang = opts.lang === 'en' ? 'en' : 'so';
  const mode = opts.mode === 'filled' ? 'filled' : 'template';
  const onboarding = opts.onboarding || null;

  let ownerAgreement;
  let terms;
  let privacy;
  const content = await siteContentService.getContent();
  const liveOwner = content.policies?.ownerAgreement || {};
  const liveTerms = content.policies?.terms || {};
  const livePrivacy = content.policies?.privacy || {};

  if (mode === 'filled' && onboarding?.agreement) {
    const snapOwner = onboarding.agreement.ownerAgreementSnapshot;
    const snapTerms = onboarding.agreement.termsSnapshot;
    const snapPrivacy = onboarding.agreement.privacySnapshot;
    ownerAgreement = pickLocale(snapOwner, lang) ? snapOwner : liveOwner;
    terms = pickLocale(snapTerms, lang) ? snapTerms : liveTerms;
    privacy = pickLocale(snapPrivacy, lang) ? snapPrivacy : livePrivacy;
  } else {
    ownerAgreement = liveOwner;
    terms = liveTerms;
    privacy = livePrivacy;
  }

  const agreementText = pickLocale(
    ownerAgreement,
    lang,
    lang === 'so'
      ? '(Heshiiska mulkiilaha lama dhigin weli — Site Content → Policies.)'
      : '(Owner agreement text is not configured yet — Site Content → Policies.)'
  );

  const titles = {
    so: {
      docTitle: 'Heshiiska Mulkiilaha Garoonka',
      subtitle: 'Nuqul heshiis · Soft A4',
      parties: 'Dhinacyada',
      stadium: 'Faahfaahinta garoonka',
      agreement: 'Qodobada heshiiska',
      related: 'Siyaasado la xiriira',
      termsNote: 'Shuruudaha adeegga iyo sirta xogta ayaa qayb ka ah heshiiskan.',
      saTitle: 'Super Admin',
      ownerTitle: 'Mulkiilaha Garoonka',
      name: 'Magaca',
      fieldCount: 'Tirada garoommada (fields)',
      templateBanner: 'Nuqul tusaale — buuxi foomka ka dib si aad u hesho PDF buuxa.',
    },
    en: {
      docTitle: 'Stadium Owner Agreement',
      subtitle: 'Agreement copy · Soft A4',
      parties: 'Parties',
      stadium: 'Stadium summary',
      agreement: 'Agreement terms',
      related: 'Related policies',
      termsNote: 'Platform Terms of Service and Privacy Policy form part of this agreement.',
      saTitle: 'Super Admin',
      ownerTitle: 'Stadium Owner',
      name: 'Name',
      fieldCount: 'Number of fields',
      templateBanner: 'Template preview — complete registration to generate a filled PDF.',
    },
  };
  const t = titles[lang];

  const [saSigBuf, ownerSigBuf] = await Promise.all([
    mode === 'filled'
      ? fetchBuffer(onboarding?.agreement?.superAdminSignatureUrl)
      : Promise.resolve(null),
    mode === 'filled' ? fetchBuffer(onboarding?.agreement?.ownerSignatureUrl) : Promise.resolve(null),
  ]);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      bufferPages: true,
      info: {
        Title: `E-Garoon — ${t.docTitle}`,
        Author: 'E-Garoon',
        Subject: 'Stadium owner onboarding agreement',
      },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Soft paper tint
    doc.rect(0, 0, PAGE.width, PAGE.height).fill(PAPER);
    drawHeader(doc, { subtitle: t.subtitle });

    doc.fillColor(INK).font('Helvetica-Bold').fontSize(16).text(t.docTitle, MARGIN, doc.y, {
      width: PAGE.width - MARGIN * 2,
      align: 'center',
    });
    doc.moveDown(0.35);
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(
        mode === 'filled' && onboarding?.id
          ? `Ref: ${String(onboarding.id)} · ${formatDate(onboarding.updatedAt || onboarding.createdAt)}`
          : `Generated ${formatDate(new Date())}`,
        { align: 'center' }
      );
    doc.moveDown(0.6);

    if (mode === 'template') {
      ensureSpace(doc, 28);
      doc.save();
      doc.roundedRect(MARGIN, doc.y, PAGE.width - MARGIN * 2, 22, 3).fill('#EEF6F0');
      doc.font('Helvetica').fontSize(8.5).fillColor(BRAND);
      doc.text(t.templateBanner, MARGIN + 8, doc.y + 6, {
        width: PAGE.width - MARGIN * 2 - 16,
      });
      doc.restore();
      doc.y += 28;
    }

    if (mode === 'filled' && onboarding) {
      sectionTitle(doc, t.parties);
      kvRow(doc, t.saTitle, 'E-Garoon Super Admin');
      kvRow(doc, t.ownerTitle, onboarding.owner?.name || '—');
      kvRow(doc, 'Email', onboarding.owner?.email || '—');
      kvRow(doc, 'Phone', onboarding.owner?.phone || '—');

      sectionTitle(doc, t.stadium);
      kvRow(doc, 'Stadium', onboarding.stadium?.name || '—');
      kvRow(
        doc,
        'Location',
        [onboarding.stadium?.area, onboarding.stadium?.city, onboarding.stadium?.region]
          .filter(Boolean)
          .join(', ') || '—'
      );
      kvRow(doc, 'Address', onboarding.stadium?.address || '—');
      const fieldCount = Array.isArray(onboarding.fields) ? onboarding.fields.length : 0;
      kvRow(doc, t.fieldCount, String(fieldCount));
      if (fieldCount) {
        const summary = onboarding.fields
          .map((f, i) => `${i + 1}. ${f.name || `Field ${i + 1}`} (${f.type})`)
          .join('\n');
        ensureSpace(doc, 24);
        doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(summary, {
          width: PAGE.width - MARGIN * 2,
        });
        doc.moveDown(0.3);
      }
    }

    sectionTitle(doc, t.agreement);
    bodyParagraphs(doc, agreementText);

    sectionTitle(doc, t.related);
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(t.termsNote, {
      width: PAGE.width - MARGIN * 2,
    });
    doc.moveDown(0.25);
    const termsPreview = pickLocale(terms, lang, '').slice(0, 280);
    const privacyPreview = pickLocale(privacy, lang, '').slice(0, 280);
    if (termsPreview) {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK).text(lang === 'so' ? 'Shuruudaha:' : 'Terms:');
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`${termsPreview}${termsPreview.length >= 280 ? '…' : ''}`, {
        width: PAGE.width - MARGIN * 2,
      });
      doc.moveDown(0.25);
    }
    if (privacyPreview) {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK).text(lang === 'so' ? 'Sirta xogta:' : 'Privacy:');
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(MUTED)
        .text(`${privacyPreview}${privacyPreview.length >= 280 ? '…' : ''}`, {
          width: PAGE.width - MARGIN * 2,
        });
      doc.moveDown(0.25);
    }

    ensureSpace(doc, 140);
    doc.moveDown(0.5);
    sectionTitle(doc, lang === 'so' ? 'Saxiixyada' : 'Signatures');

    paintSignaturePair(
      doc,
      {
        title: t.saTitle,
        nameLabel: t.name,
        nameValue: mode === 'filled' ? 'E-Garoon Super Admin' : '',
        dateValue:
          mode === 'filled' ? formatDate(onboarding?.agreement?.superAdminSignedAt) : '',
        imageBuffer: saSigBuf,
      },
      {
        title: t.ownerTitle,
        nameLabel: t.name,
        nameValue: mode === 'filled' ? onboarding?.owner?.name || '' : '',
        dateValue: mode === 'filled' ? formatDate(onboarding?.agreement?.ownerSignedAt) : '',
        imageBuffer: ownerSigBuf,
      }
    );

    drawFooter(doc);
    doc.end();
  });
}

async function buildTemplatePdf({ lang } = {}) {
  const buffer = await buildAgreementPdf({ mode: 'template', lang });
  const stamp = new Date().toISOString().slice(0, 10);
  const locale = lang === 'en' ? 'en' : 'so';
  return {
    buffer,
    contentType: 'application/pdf',
    filename: `kulansiiye-owner-agreement-template-${locale}-${stamp}.pdf`,
  };
}

async function buildFilledPdf(onboardingId, { lang } = {}) {
  const doc = await OwnerOnboarding.findById(onboardingId);
  if (!doc) throw ApiError.notFound('Onboarding not found');
  const onboarding = {
    id: doc._id,
    owner: doc.owner,
    stadium: doc.stadium,
    fields: doc.fields,
    agreement: doc.agreement,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    status: doc.status,
  };
  const buffer = await buildAgreementPdf({ mode: 'filled', lang, onboarding });
  const stamp = new Date().toISOString().slice(0, 10);
  const locale = lang === 'en' ? 'en' : 'so';
  const safeName = String(doc.owner?.name || 'owner')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  return {
    buffer,
    contentType: 'application/pdf',
    filename: `kulansiiye-owner-agreement-${safeName || 'draft'}-${locale}-${stamp}.pdf`,
  };
}

module.exports = {
  buildTemplatePdf,
  buildFilledPdf,
  buildAgreementPdf,
};
