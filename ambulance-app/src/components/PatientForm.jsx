import React from 'react';
import { Ambulance, Activity, Droplets, FileText, AlertTriangle, ChevronRight, MapPin } from 'lucide-react';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const SEVERITY_OPTIONS = [
  { value: 'Critical', label: 'Critical', dotClass: 'critical', activeClass: 'active-critical' },
  { value: 'Serious',  label: 'Serious',  dotClass: 'serious',  activeClass: 'active-serious'  },
  { value: 'Moderate', label: 'Moderate', dotClass: 'moderate', activeClass: 'active-moderate' },
];

export default function PatientForm({ onSubmit, loading, locationReady }) {
  const [form, setForm] = React.useState({
    blood_group: '',
    oxygen_level: '',
    patient_condition_notes: '',
    severity_level: '',
    required_specialty: '',
  });
  const [errors, setErrors] = React.useState({});

  const validate = () => {
    const e = {};
    if (!form.blood_group)    e.blood_group    = 'Select blood group';
    if (!form.oxygen_level)   e.oxygen_level   = 'Enter oxygen level';
    else if (Number(form.oxygen_level) < 0 || Number(form.oxygen_level) > 100)
      e.oxygen_level = 'Must be 0–100';
    if (!form.patient_condition_notes.trim()) e.patient_condition_notes = 'Enter condition notes';
    if (!form.severity_level) e.severity_level = 'Select severity';
    return e;
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSubmit(form);
  };

  return (
    <form className="patient-form" onSubmit={handleSubmit} noValidate>
      <div className="form-title">
        <div className="form-title-icon"><Ambulance size={16} /></div>
        Patient Emergency Details
      </div>
      <div className="form-divider" />

      {/* Blood Group */}
      <div className="form-group">
        <label className="form-label">
          <Droplets size={11} /> Blood Group
        </label>
        <select
          id="blood_group"
          className={`form-control${errors.blood_group ? ' error' : ''}`}
          value={form.blood_group}
          onChange={e => handleChange('blood_group', e.target.value)}
        >
          <option value="">Select blood group</option>
          {BLOOD_GROUPS.map(bg => (
            <option key={bg} value={bg}>{bg}</option>
          ))}
        </select>
        {errors.blood_group && (
          <span className="form-error"><AlertTriangle size={11} />{errors.blood_group}</span>
        )}
      </div>

      {/* Oxygen Level */}
      <div className="form-group">
        <label className="form-label">
          <Activity size={11} /> Oxygen Level (SpO₂ %)
        </label>
        <input
          id="oxygen_level"
          type="number"
          min="0"
          max="100"
          className={`form-control${errors.oxygen_level ? ' error' : ''}`}
          placeholder="e.g. 94"
          value={form.oxygen_level}
          onChange={e => handleChange('oxygen_level', e.target.value)}
        />
        {errors.oxygen_level && (
          <span className="form-error"><AlertTriangle size={11} />{errors.oxygen_level}</span>
        )}
      </div>

      {/* Condition Notes */}
      <div className="form-group">
        <label className="form-label">
          <FileText size={11} /> Condition Notes
        </label>
        <textarea
          id="patient_condition_notes"
          className={`form-control${errors.patient_condition_notes ? ' error' : ''}`}
          placeholder="Describe patient condition, symptoms, known allergies…"
          value={form.patient_condition_notes}
          onChange={e => handleChange('patient_condition_notes', e.target.value)}
        />
        {errors.patient_condition_notes && (
          <span className="form-error"><AlertTriangle size={11} />{errors.patient_condition_notes}</span>
        )}
      </div>

      {/* Required Specialty */}
      <div className="form-group">
        <label className="form-label">Required Specialty (optional)</label>
        <input
          id="required_specialty"
          className="form-control"
          placeholder="e.g. cardiac, trauma, neuro"
          value={form.required_specialty}
          onChange={e => handleChange('required_specialty', e.target.value)}
        />
      </div>

      {/* Severity */}
      <div className="form-group">
        <label className="form-label">Severity Level</label>
        <div className="severity-grid">
          {SEVERITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`severity-btn${form.severity_level === opt.value ? ' ' + opt.activeClass : ''}`}
              onClick={() => handleChange('severity_level', opt.value)}
            >
              <span className={`severity-dot ${opt.dotClass}`} />
              {opt.label}
            </button>
          ))}
        </div>
        {errors.severity_level && (
          <span className="form-error"><AlertTriangle size={11} />{errors.severity_level}</span>
        )}
      </div>

      {!locationReady && (
        <div className="error-banner">
          <MapPin size={13} /> Waiting for GPS location…
        </div>
      )}

      <button
        id="find-hospitals-btn"
        type="submit"
        className="btn btn-primary"
        disabled={loading || !locationReady}
      >
        {loading
          ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Finding…</>
          : <><ChevronRight size={16} /> Find Best Hospital</>
        }
      </button>
    </form>
  );
}
