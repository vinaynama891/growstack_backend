const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

// Caller (Salesman) accounts
const CallerSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, default: 'Caller' }
});

// Sales Leads submitted by callers
const SalesLeadSchema = new mongoose.Schema({
  businessName: { type: String, required: true },
  businessmanName: { type: String, required: true },
  contactNumber: { type: String, required: true },
  status: { type: String, enum: ['interested', 'not interested', 'follow up'], required: true },
  callRecording: { type: String, default: '' }, // URL or base64, optional
  notes: { type: String, default: '' },
  submittedBy: { type: String, default: '' }, // caller email
  createdAt: { type: Date, default: Date.now }
});

const ServiceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, default: 'Briefcase' },
  order: { type: Number, default: 0 }
});

const LeadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contactNumber: { type: String, required: true },
  businessName: { type: String, required: true },
  status: { type: String, enum: ['new', 'follow up', 'interested', 'not interested'], default: 'new' },
  requirements: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const ProjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  projectUrl: { type: String, required: true },
  order: { type: Number, default: 0 },
  imageUrl: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const InstallmentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true, default: Date.now },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const FinanceSchema = new mongoose.Schema({
  type: { type: String, enum: ['income', 'expense'], required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  amount: { type: Number, required: true, min: 0 },
  // Income-specific fields
  discount: { type: Number, default: 0, min: 0 },
  paid: { type: Number, default: 0, min: 0 },     // sum of all installments
  pending: { type: Number, default: 0, min: 0 },   // amount - discount - paid
  installments: { type: [InstallmentSchema], default: [] },
  category: { type: String, default: 'General' },
  date: { type: Date, required: true, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  Admin: mongoose.model('Admin', AdminSchema),
  Caller: mongoose.model('Caller', CallerSchema),
  Service: mongoose.model('Service', ServiceSchema),
  Lead: mongoose.model('Lead', LeadSchema),
  SalesLead: mongoose.model('SalesLead', SalesLeadSchema),
  Project: mongoose.model('Project', ProjectSchema),
  Finance: mongoose.model('Finance', FinanceSchema)
};
