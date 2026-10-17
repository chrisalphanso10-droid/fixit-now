/**
 * FixIt Now - KYC Upload Middleware (Multer)
 * Stores files outside of any public web root.
 * Validates file types: PDF for documents, JPEG/PNG for photos.
 * Enforces size limits: 5MB for documents, 2MB for passport photos.
 * Conforms to SRS Section 4, FR-P4 & docs/PLAN.md Phase 4.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage directory outside any public root
export const KYC_UPLOAD_DIR = path.resolve(__dirname, '../../uploads/kyc');

// Ensure directory exists
if (!fs.existsSync(KYC_UPLOAD_DIR)) {
  fs.mkdirSync(KYC_UPLOAD_DIR, { recursive: true });
}

// Multer Disk Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(KYC_UPLOAD_DIR)) {
      fs.mkdirSync(KYC_UPLOAD_DIR, { recursive: true });
    }
    cb(null, KYC_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const partnerId = req.user?.id ? String(req.user.id).slice(0, 8) : 'anon';
    const fieldTag = file.fieldname || 'doc';
    const randomHex = crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanFileName = `kyc_${partnerId}_${fieldTag}_${Date.now()}_${randomHex}${ext}`;
    cb(null, cleanFileName);
  },
});

// File filter for KYC documents (PDF) and photo (JPEG/PNG)
const fileFilter = (req, file, cb) => {
  const allowedDocMimes = ['application/pdf'];
  const allowedPhotoMimes = ['image/jpeg', 'image/jpg', 'image/png'];

  const ext = path.extname(file.originalname).toLowerCase();

  if (file.fieldname === 'photo') {
    if (allowedPhotoMimes.includes(file.mimetype) || ['.jpg', '.jpeg', '.png'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Passport photo must be in JPEG or PNG format (SRS FR-P4).'), false);
    }
  } else if (file.fieldname === 'document' || file.fieldname === 'trade_cert') {
    if (allowedDocMimes.includes(file.mimetype) || ext === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('Identity and trade qualification documents must be in PDF format (SRS FR-P4).'), false);
    }
  } else {
    // Other uploaded file
    if ([...allowedDocMimes, ...allowedPhotoMimes].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type for ${file.fieldname}. Upload PDF or JPEG/PNG only.`), false);
    }
  }
};

// Configure Multer instance with 5MB global max file size
export const kycUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 5,
  },
});

// Specific upload fields for partner KYC
export const partnerKycUploadFields = kycUpload.fields([
  { name: 'document', maxCount: 1 },    // PDF
  { name: 'photo', maxCount: 1 },       // JPEG/PNG
  { name: 'trade_cert', maxCount: 1 },  // PDF (optional)
]);

// Request Photo Storage directory
export const REQUEST_UPLOAD_DIR = path.resolve(__dirname, '../../uploads/requests');
if (!fs.existsSync(REQUEST_UPLOAD_DIR)) {
  fs.mkdirSync(REQUEST_UPLOAD_DIR, { recursive: true });
}

// Storage for request photos
const requestStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(REQUEST_UPLOAD_DIR)) {
      fs.mkdirSync(REQUEST_UPLOAD_DIR, { recursive: true });
    }
    cb(null, REQUEST_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const custId = req.user?.id ? String(req.user.id).slice(0, 8) : 'cust';
    const randomHex = crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `req_${custId}_${Date.now()}_${randomHex}${ext}`);
  },
});

const requestPhotoFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(file.mimetype) || ['.jpg', '.jpeg', '.png'].includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Uploaded photo must be a valid JPEG or PNG image.'), false);
  }
};

export const requestPhotoUpload = multer({
  storage: requestStorage,
  fileFilter: requestPhotoFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
}).single('photo');

export default {
  KYC_UPLOAD_DIR,
  REQUEST_UPLOAD_DIR,
  kycUpload,
  partnerKycUploadFields,
  requestPhotoUpload,
};

