const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
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

const FinanceSchema = new mongoose.Schema({
  type: { type: String, enum: ['income', 'expense'], required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, default: 'General' },
  date: { type: Date, required: true, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  Admin: mongoose.model('Admin', AdminSchema),
  Service: mongoose.model('Service', ServiceSchema),
  Lead: mongoose.model('Lead', LeadSchema),
  Project: mongoose.model('Project', ProjectSchema),
  Finance: mongoose.model('Finance', FinanceSchema)
};
