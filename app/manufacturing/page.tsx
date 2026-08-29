"use client";
/**
 * app/manufacturing/page.tsx — Manufacturing Knowledge Modules
 *
 * Reference guide for process-specific quality risks, key characteristics,
 * common failure modes, and audit focus areas.
 * Used as onsite reference during audits.
 */
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";

interface KnowledgeModule {
  id: string;
  process: string;
  icon: string;
  overview: string;
  keyRisks: string[];
  ctfCharacteristics: string[];
  documentsToRequest: string[];
  auditQuestions: string[];
  commonNonConformances: string[];
}

const MODULES: KnowledgeModule[] = [
  {
    id: "cnc",
    process: "CNC Machining",
    icon: "⚙️",
    overview: "Subtractive manufacturing using computer-controlled cutting tools. Key quality drivers are dimensional accuracy, surface finish, and material integrity.",
    keyRisks: ["Tool wear causing dimensional drift", "Coolant contamination of material", "Incorrect datum setup", "Thermal expansion affecting tight tolerances", "Chip entrapment in bores"],
    ctfCharacteristics: ["Critical diameters and bores (±0.01mm or tighter)", "Thread forms and engagement length", "Surface roughness (Ra values)", "Concentricity and runout", "Flatness and perpendicularity of datum faces"],
    documentsToRequest: ["Setup sheets with datum references", "First-off inspection records", "Tool change/life records", "CMM printouts for CTF dimensions", "Calibration certificates for gauges"],
    auditQuestions: ["How is tool wear monitored and at what frequency?", "What is the process for first-off approval before batch production?", "How are CTF dimensions verified in-process?", "Show me the last CMM report for this part.", "How is scrap segregated and recorded?"],
    commonNonConformances: ["No Cpk data for CTF characteristics", "Tool life limits not defined", "Gauge calibration expired", "No in-process check frequency defined in Control Plan", "Operator relying on feel rather than instruments"],
  },
  {
    id: "stamping",
    process: "Sheet Metal Stamping",
    icon: "🔨",
    overview: "High-volume forming of sheet metal using progressive or transfer dies. Key risks are tool wear, material variation, and springback.",
    keyRisks: ["Die wear causing dimensional drift over long runs", "Material hardness variation affecting springback", "Burr height on cut edges", "Blank feeding errors", "Lubricant inconsistency"],
    ctfCharacteristics: ["Hole positions and diameters", "Blank size and edge condition", "Flange angles and springback allowance", "Burr height (typically ≤0.1mm)", "Flatness after forming"],
    documentsToRequest: ["Die maintenance records", "Material test certificates (hardness, tensile strength)", "First-off and in-process inspection sheets", "Burr height measurement records", "SPC charts for critical hole positions"],
    auditQuestions: ["What is the die maintenance interval and what triggers early replacement?", "How is springback compensated and verified?", "How often are burr heights measured?", "What material certifications are received and checked?", "Show me the last die inspection report."],
    commonNonConformances: ["No die maintenance schedule", "Material certs not reviewed on receipt", "In-process inspection frequency not defined", "No burr height specification on drawing or Control Plan"],
  },
  {
    id: "casting",
    process: "Die Casting / Investment Casting",
    icon: "🪣",
    overview: "Metal poured into moulds to produce near-net-shape parts. Key risks are porosity, shrinkage, and dimensional variation from cooling.",
    keyRisks: ["Internal porosity (gas or shrinkage)", "Cold shuts and misruns", "Dimensional variation due to die wear or thermal expansion", "Inclusion contamination", "Surface defects requiring rework"],
    ctfCharacteristics: ["Wall thickness uniformity", "Critical machined features post-casting", "Pressure-tight areas (if applicable)", "Surface condition in sealing faces", "Chemical composition (alloy spec)"],
    documentsToRequest: ["X-ray or CT scan reports for critical features", "Chemical analysis / spectrometer certificates", "Casting process parameters log (temperature, pressure, cycle time)", "Die condition inspection records", "Pressure test results (if applicable)"],
    auditQuestions: ["How is porosity detected — is X-ray used, and what is the sampling plan?", "What are the casting temperature limits and how are they monitored?", "How are out-of-spec alloy heats handled?", "Show me the last die inspection record.", "What is the process for rework, and how is it documented?"],
    commonNonConformances: ["No X-ray sampling for critical castings", "Chemical certs not lot-traceable", "No documented parameter limits", "Rework undocumented and uninspected"],
  },
  {
    id: "injection",
    process: "Plastic Injection Moulding",
    icon: "🔩",
    overview: "Thermoplastic or thermoset material injected into a mould under pressure. Key risks are dimensional variation from shrinkage, weld lines, and material degradation.",
    keyRisks: ["Shrinkage variation affecting dimensions", "Weld line weakness in structural areas", "Moisture in material causing splay or voids", "Incorrect colour/grade material loaded", "Flash on parting lines"],
    ctfCharacteristics: ["Critical snap-fit and engagement features", "Wall thickness for structural integrity", "Gate location vs weld line position", "Surface texture and colour", "Chemical resistance (if applicable)"],
    documentsToRequest: ["Material drying records and moisture content", "Process parameter sheets (temperature, pressure, cooling time)", "Colour and material certificates per batch", "Dimensional inspection records", "Gate and weld line location drawings"],
    auditQuestions: ["How is material drying monitored and controlled?", "How are weld lines located relative to load-bearing features?", "What happens if colour fails — is product quarantined?", "Show me the last cavity balance check.", "How is regrind controlled?"],
    commonNonConformances: ["No drying time/temperature records", "Regrind percentage not controlled", "Weld line not considered in PFMEA", "Colour check not included in Control Plan"],
  },
  {
    id: "welding",
    process: "Welding / Fabrication",
    icon: "🔥",
    overview: "Joining of metal parts by fusion. Key risks are weld quality (porosity, cracks, undercut), distortion, and welder qualification.",
    keyRisks: ["Porosity and lack of fusion", "Hot and cold cracking", "Distortion affecting assembly features", "Unqualified weld procedures or welders", "Incorrect filler material"],
    ctfCharacteristics: ["Weld throat size and leg length", "Joint penetration on structural welds", "Post-weld dimensional accuracy", "Visual weld quality (ISO 5817 level)", "NDT results for critical joints"],
    documentsToRequest: ["Welding procedure specifications (WPS) — qualified to ISO 15614 or AWS", "Welder qualification certificates (WQR/WQT) — current", "NDT reports (RT, UT, PT, MT)", "Dimensional inspection after welding", "Filler material batch certificates"],
    auditQuestions: ["Are all welders certified and are certificates current?", "Show me the WPS for this joint type.", "What NDT is performed and at what frequency?", "How is distortion measured and corrected?", "How are filler materials stored and identified?"],
    commonNonConformances: ["WPS not available at the workstation", "Welder certs expired", "No NDT for safety-critical welds", "Filler material not identified by batch", "No post-weld dimensional check"],
  },
  {
    id: "plating",
    process: "Electroplating / Surface Treatment",
    icon: "✨",
    overview: "Electrochemical or chemical deposition of a coating for corrosion protection, appearance, or functional properties. Key risks are bath control and coating thickness.",
    keyRisks: ["Coating thickness out of specification", "Adhesion failure due to poor pre-treatment", "Hydrogen embrittlement in high-strength steels", "Contaminated bath chemistry", "Salt spray failure"],
    ctfCharacteristics: ["Coating thickness (min/max)", "Adhesion (cross-hatch or pull-off test)", "Corrosion resistance (salt spray hours)", "Appearance (colour, gloss)", "Hydrogen embrittlement relief bake (if applicable)"],
    documentsToRequest: ["Bath chemistry analysis records (frequency?)", "Coating thickness measurement records", "Salt spray test reports", "Bake relief records for high-strength steel parts", "Processor approval certificates"],
    auditQuestions: ["How often is bath chemistry analysed and by whom?", "What thickness gauges are used and are they calibrated?", "Is hydrogen embrittlement relief baking performed — show records?", "What is the salt spray test frequency and sample size?", "Show me the last processor approval certificate."],
    commonNonConformances: ["Bath chemistry checked infrequently or by operator only", "No embrittlement bake for >1000 MPa fasteners", "Thickness measurement not recorded per batch", "Salt spray not performed on production parts"],
  },
  {
    id: "painting",
    process: "Painting / Powder Coating",
    icon: "🎨",
    overview: "Application of liquid paint or powder coat for corrosion protection and appearance. Key risks are surface preparation, film thickness, and adhesion.",
    keyRisks: ["Poor adhesion due to inadequate pre-treatment", "Film thickness variation (too thin = corrosion, too thick = cracks)", "Orange peel and sagging in wet paint", "Contamination (oil, dust, moisture)", "UV fade or colour shift"],
    ctfCharacteristics: ["Dry film thickness (DFT)", "Adhesion (cross-hatch per ISO 2409)", "Impact resistance (if structural)", "Gloss and colour (spectrophotometer reading)", "Corrosion resistance (salt spray)"],
    documentsToRequest: ["Pre-treatment process records (phosphate concentration, pH, temperature)", "DFT measurement records per batch", "Adhesion test records", "Salt spray test reports", "Colour approval standards"],
    auditQuestions: ["How is pre-treatment bath controlled and how often is it tested?", "What DFT is specified and how is it measured (probe calibration)?", "What is the adhesion test frequency?", "Is there an approved colour standard sample and where is it kept?", "What happens to parts that fail DFT?"],
    commonNonConformances: ["Pre-treatment bath not regularly analysed", "DFT not measured per batch — only spot-checked", "No adhesion testing frequency defined", "Colour standard not formally approved"],
  },
  {
    id: "heattreat",
    process: "Thermal Processing (Heat Treatment)",
    icon: "🌡️",
    overview: "Controlled heating and cooling to alter mechanical properties. Key risks are temperature uniformity, atmosphere control, and traceability.",
    keyRisks: ["Temperature non-uniformity in furnace (TUS failure)", "Atmosphere contamination causing decarburisation", "Quench rate variation affecting hardness", "Batch traceability loss", "Distortion from thermal stress"],
    ctfCharacteristics: ["Core and surface hardness (HRC/HV)", "Case depth (for case hardening)", "Hardness uniformity across the part", "Post-treatment dimensional accuracy", "Tensile/yield strength (if tested)"],
    documentsToRequest: ["Furnace temperature uniformity survey (TUS) records — AMS 2750", "Batch process records (time, temperature, atmosphere)", "Hardness test records per batch", "System accuracy test (SAT) records for all instruments", "Processor approval / NADCAP certificate"],
    auditQuestions: ["When was the last TUS performed and what were the results?", "How is batch traceability maintained through the furnace?", "What hardness testing is done — all parts, samples, or first-off?", "Show me the SAT records for the thermocouples.", "Is the processor NADCAP approved for this process?"],
    commonNonConformances: ["TUS overdue or out of tolerance zones used", "Batch records not retained with part traceability", "Hardness not tested per batch — assumed from recipe", "No NADCAP approval for aerospace applications"],
  },
  {
    id: "assembly",
    process: "Assembly",
    icon: "🔧",
    overview: "Joining of sub-components into a final assembly. Key risks are incorrect parts, torque control, and error-proofing.",
    keyRisks: ["Wrong part or revision installed", "Fastener torque not met or not verified", "Orientation errors (poka-yoke failures)", "Handling damage to finished surfaces", "Missing components (not detected before shipping)"],
    ctfCharacteristics: ["Torque values for safety-critical fasteners", "Correct part and revision at each station", "Assembly geometry (gap, flush, alignment)", "Functional test pass/fail", "Traceability labels applied correctly"],
    documentsToRequest: ["Work instructions at each assembly station", "Torque tool calibration records", "Poka-yoke test/validation records", "End-of-line test records", "Non-conformance and rework records"],
    auditQuestions: ["How is correct part selection controlled — is there a kanban, barcode scan, or bin system?", "Show me the torque tool calibration for this station.", "How are poka-yoke devices tested and at what frequency?", "What is the end-of-line test and what does it check?", "How are missing-part errors detected before shipping?"],
    commonNonConformances: ["Work instructions not at revision level", "Torque tool calibration overdue", "Poka-yoke device not formally tested", "No end-of-line functional test", "Rework not documented or re-inspected"],
  },
];

export default function ManufacturingPage() {
  const [selected, setSelected] = useState<string>(MODULES[0].id);
  const [section, setSection] = useState<"risks" | "ctf" | "docs" | "questions" | "ncs">("risks");

  const mod = MODULES.find((m) => m.id === selected)!;

  const SECTIONS = [
    { id: "risks",     label: "Key Risks" },
    { id: "ctf",       label: "CTF Characteristics" },
    { id: "docs",      label: "Documents to Request" },
    { id: "questions", label: "Audit Questions" },
    { id: "ncs",       label: "Common NCs" },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manufacturing Knowledge"
        subtitle="Process-specific quality risks, audit focus areas and common non-conformances"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Manufacturing" }]}
      />

      {/* Process selector */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {MODULES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => { setSelected(m.id); setSection("risks"); }}
            className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-center transition-all ${
              selected === m.id
                ? "bg-blue-600 text-white border-blue-600 shadow"
                : "bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50"
            }`}
          >
            <span className="text-xl">{m.icon}</span>
            <span className="text-xs font-medium leading-tight">{m.process}</span>
          </button>
        ))}
      </div>

      {/* Module content */}
      <Card title={`${mod.icon} ${mod.process}`}>
        <p className="text-sm text-slate-600 mb-4">{mod.overview}</p>

        {/* Section tabs */}
        <div className="flex flex-wrap gap-1 mb-4 border-b border-slate-200 pb-3">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${
                section === s.id
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <ul className="space-y-2">
          {(section === "risks" ? mod.keyRisks
            : section === "ctf" ? mod.ctfCharacteristics
            : section === "docs" ? mod.documentsToRequest
            : section === "questions" ? mod.auditQuestions
            : mod.commonNonConformances
          ).map((item, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-700">
              <span className="text-slate-400 shrink-0 mt-0.5">
                {section === "risks" ? "⚠" : section === "ncs" ? "✕" : section === "questions" ? "?" : "•"}
              </span>
              {item}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
