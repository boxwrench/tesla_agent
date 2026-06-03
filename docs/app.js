/* ==============================================================================
   app.js — Interactive Client Logic for tesla_agent Web Dashboard
   ============================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initSetupStepper();
  initModelFinder();
  initBenchmarkChart();
  initGuideTab();
});

/* ================= Tab Navigation ================= */
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const pageTitle = document.getElementById('page-title') || document.getElementById('main-title');

  function switchToTab(targetTab) {
    navItems.forEach(nav => {
      nav.classList.toggle('active', nav.getAttribute('data-tab') === targetTab);
    });
    tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `tab-${targetTab}`);
    });
    if (pageTitle) {
      const activeNav = document.querySelector(`.nav-item[data-tab="${targetTab}"]`);
      if (activeNav) pageTitle.textContent = activeNav.textContent.trim();
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => switchToTab(item.getAttribute('data-tab')));
  });

  // Inline links with data-tab-link="<name>" switch tabs (used by safety callout etc.)
  document.querySelectorAll('[data-tab-link]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchToTab(link.getAttribute('data-tab-link'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

/* ================= Setup Stepper ================= */
function initSetupStepper() {
  const stepButtons = document.querySelectorAll('.setup-step-btn');
  const stepContents = document.querySelectorAll('.setup-step-content');
  const btnPrev = document.getElementById('btn-prev-step');
  const btnNext = document.getElementById('btn-next-step');
  const progressSpan = document.getElementById('setup-progress');
  
  let currentStep = 1;
  const totalSteps = stepButtons.length;

  function updateStepsUI() {
    // Hide all contents and remove active class from buttons
    stepContents.forEach(content => content.classList.remove('active'));
    stepButtons.forEach(btn => btn.classList.remove('active'));

    // Show current step content
    document.getElementById(`setup-step-${currentStep}`).classList.add('active');
    
    // Highlight current button
    document.getElementById(`step-btn-${currentStep}`).classList.add('active');

    // Manage completed states (all steps up to current-1 are completed)
    stepButtons.forEach((btn, index) => {
      const stepIndex = index + 1;
      if (stepIndex < currentStep) {
        btn.classList.add('completed');
      } else {
        btn.classList.remove('completed');
      }
    });

    // Disable/Enable Navigation Buttons
    btnPrev.disabled = currentStep === 1;
    if (currentStep === totalSteps) {
      btnNext.textContent = "Finish Setup";
    } else {
      btnNext.textContent = "Next Step";
      btnNext.disabled = false;
    }

    // Calculate and update progress percentage
    const progressPercent = Math.round(((currentStep - 1) / (totalSteps - 1)) * 100);
    progressSpan.textContent = `${progressPercent}% Done`;
  }

  // Next Button Click
  btnNext.addEventListener('click', () => {
    if (currentStep < totalSteps) {
      currentStep++;
      updateStepsUI();
    } else {
      alert("All setup steps completed! You are ready to verify your model using the Log Verifier tab.");
    }
  });

  // Previous Button Click
  btnPrev.addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      updateStepsUI();
    }
  });

  // Sidebar buttons click directly
  stepButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentStep = parseInt(btn.getAttribute('data-step'));
      updateStepsUI();
    });
  });

  // Initialize
  updateStepsUI();
}

/* ================= Model Recommendation Finder ================= */
function initModelFinder() {
  const priorityRadios = document.querySelectorAll('input[name="finder-priority"]');
  
  const recModelName = document.getElementById('rec-model-name');
  const recMode = document.getElementById('rec-mode');
  const recFile = document.getElementById('rec-file');
  const recSize = document.getElementById('rec-size');
  const recSpeed = document.getElementById('rec-speed');
  const recReasoning = document.getElementById('rec-reasoning');
  const recCommand = document.getElementById('rec-command');
  const recHermesConfig = document.getElementById('rec-hermes-config');
  const recRationale = document.getElementById('rec-rationale');

  const modelMatrix = {
    'code-fast': {
      name: "Qwen 3.6 35B Mixture-of-Experts (MXFP4 Quant)",
      mode: "CODE — fast workhorse",
      file: "Qwen3.6-35B-A3B-MXFP4_MOE.gguf",
      size: "21.7 GB",
      speed: "~58.5 tokens/sec (Vulkan/RADV; ~44.2 t/s ROCm fallback). Optional MTP speed lanes: ~72.7 t/s MXFP4-MTP (19.3 GB), ~81.2 t/s Q4_K_M-MTP (20.7 GB).",
      reasoning: "Uncapped think-on — do NOT budget the coding route",
      command: "bash scripts/serving/serve_vulkan.sh",
      hermes: "max_tokens: 8192",
      rationale: "First reach for any coding or multi-step agent task. Best balance of reasoning quality and speed on a 128 GB APU (82/84 rubric, 3/3 nonce gate). Vulkan/RADV is the promoted backend; ROCm is the fallback. The optional Qwen3.6-35B-A3B-MTP GGUF lanes use --spec-type draft-mtp for +24-39% decode speed after separate quality gating. Keep the standard MXFP4 workhorse as the default setup path unless you are deliberately opting into MTP."
    },
    'code-coder-next': {
      name: "Qwen3-Coder-Next (UD-Q4_K_XL)",
      mode: "CODE — hard-coding challenger",
      file: "Qwen3-Coder-Next-UD-Q4_K_XL.gguf",
      size: "49.6 GB",
      speed: "44.4 tokens/sec decode; 723.2 tokens/sec prefill (Vulkan/RADV b9360)",
      reasoning: "Reasoning off in promoted run; orchestrated 4-step coding artifact passed saved grader checks",
      command: "BACKEND=vulkan PORT=8097 scripts/serve/qwen3_coder_next_serve.sh",
      hermes: "max_tokens: 8192\nctx_size: 32768",
      rationale: "Use when the task is explicitly code-heavy and you want a coding-specialized MoE route. Vulkan b9360 promoted over the older ROCm row: 44.4 t/s decode and 723.2 t/s prefill versus ROCm 38.5/663.4. The saved result is one orchestrated 4-step coding task with all grader checks passing, not five independent E2E runs."
    },
    'code-peer': {
      name: "Gemma 4 31B IT (Q6_K)",
      mode: "EXPERIMENT — Gemma dense (orchestrated; ~8 tok/s decode)",
      file: "gemma-4-31B-it-Q6_K.gguf",
      size: "25.2 GB",
      speed: "~8.25 tok/s tg128; ~7.7 tok/s sustained (Vulkan/RADV) — pp8192 prefill ~133.6 tok/s",
      reasoning: "On for coding; use orchestrated multi-step pattern",
      command: "bash scripts/serving/serve_vulkan.sh --model gemma-4-31B-it-Q6_K.gguf --cache-type-k f16 --cache-type-v f16",
      hermes: "max_tokens: 8192",
      rationale: "Cross-family second opinion when a single long coding episode degrades, or for tasks where Qwen's style has plateaued. Cleared nonce 3/3 (think-off and think-on) and orchestrated coding 3/3 E2E; the orchestrated/staged path is what graduated, not single-episode. Won 4-2 quality pairwise vs Gemma 4 26B-A4B. SPEED NOTE: Gemma 31B is a dense model — every token reads all 31B parameters. Decode is ~8 tok/s, far slower than Qwen 35B MoE (~58.5 tok/s workhorse) or gpt-oss-120B (~46 tok/s). Prefill is fast (~133.6 tok/s pp8192). Use on the orchestrated path for quality verification, not as a speed-first workhorse."
    },
    'extract': {
      name: "Qwen 3.6 35B Mixture-of-Experts (MXFP4 Quant)",
      mode: "EXTRACT — no-think fast",
      file: "Qwen3.6-35B-A3B-MXFP4_MOE.gguf",
      size: "21.7 GB",
      speed: "~43.7 tokens/sec (faster wall-time by avoiding reasoning decode)",
      reasoning: "Disabled via server reasoning flag (--reasoning off)",
      command: "bash scripts/serving/serve_rocm.sh --reasoning off",
      hermes: "max_tokens: 4096",
      rationale: "Simple telemetry extraction and log parsing do not require reasoning. Disabling thinking using --reasoning off on current builds saves 50%+ wall-clock time and guarantees tool-use calls fire directly. Note: --reasoning-budget 0 is broken upstream and must not be used (causes empty responses). The older template-kwarg method ('enable_thinking: false') is deprecated and prints warnings."
    },
    'synthesis-baseline': {
      name: "gpt-oss-120B (MXFP4, 3 shards)",
      mode: "SYNTHESIS — quality baseline",
      file: "gpt-oss-120b-mxfp4-0000{1..3}-of-00003.gguf",
      size: "~63 GB",
      speed: "~46 tokens/sec (Vulkan/RADV)",
      reasoning: "High reasoning, draft-with-illustrative-assumptions system prompt",
      command: "Configure the local server for the gpt-oss-120B shard set",
      hermes: "max_tokens: 8192\nsystem prompt: draft with labeled assumptions",
      rationale: "The current general quality baseline after blinded pairwise wins of 5-1 vs Qwen 35B and 4-2 vs Qwen 122B (single judge, seed-fixed A/B order). Requires the 'draft with illustrative assumptions' system prompt; pre-prompt behavior was deflection-with-checklist (the 3-3 pre-fix pairwise vs 35B measured the prompt bug, not the model). Use for master-plan reports, research synthesis, multi-document summarization."
    },
    'synthesis-specialist': {
      name: "Qwen 3.5 122B-A10B MTP (MXFP4_MOE)",
      mode: "SYNTHESIS — regulatory specialist",
      file: "Qwen3.5-122B-A10B-MTP-MXFP4_MOE.gguf",
      size: "~70 GB (ctx 12,288 safe cap)",
      speed: "28.3 tokens/sec decode; 324.9 tokens/sec prefill (Vulkan/RADV b9360)",
      reasoning: "Deep reasoning active; tuned MTP uses DRAFT_N=1 and PMIN unset",
      command: "DRAFT_N=1 PORT=8098 bash scripts/qwen122b_mtp_vulkan_serve.sh",
      hermes: "max_tokens: 8192\nctx_size: 12288",
      rationale: "Reserved as a QUALITY spot-specialist for regulatory-currency tasks and incisive plan review. The tuned native-MTP Vulkan lane lifts the old 19.4 t/s ROCm route to 28.3 t/s with 81.8% MTP-probe acceptance and coding PASS 5/5 E2E. DRAFT_N=2 remains slightly better for two-slot aggregate, but DRAFT_N=1 wins single-stream responsiveness."
    },
    'synthesis-stepfun': {
      name: "StepFun Step-3.7-Flash MTP",
      mode: "SYNTHESIS — large contender",
      file: "Step-3.7-Flash-UD-IQ4_XS + Step-3.7-Flash-MTP-Q8_0.gguf",
      size: "88.79 GiB main + 3.5 GB draft",
      speed: "26.0 tokens/sec decode; 211.2 tokens/sec prefill (patched Vulkan b9360)",
      reasoning: "Model-native template; no Qwen-style think toggle",
      command: "bash scripts/serve/stepfun_mtp_vulkan_serve.sh",
      hermes: "max_tokens: 8192\nctx_size: 12288",
      rationale: "Use as a large-model quality contender when the task merits spending the 26 t/s tier. Private pairwise favored plain StepFun 6-0 vs gpt-oss-soulfix and 4-0-2 vs 122B, and the MTP lane passed nonce 3/3 plus coding PASS 5/5 E2E. It should not become the public default until an independent judge/calibration pass confirms the pairwise result. Artificial Analysis lists Step 3.7 Flash at Intelligence Index 43."
    },
    'companion': {
      name: "Gemma 4 26B-A4B IT (UD-Q6_K_XL)",
      mode: "COMPANION — small-footprint MoE",
      file: "gemma-4-26B-A4B-it-UD-Q6_K_XL.gguf",
      size: "21.2 GB",
      speed: "~44.8 tokens/sec tg128; pp512 ~1003 tokens/sec (Vulkan/RADV)",
      reasoning: "Off in tested gate; 3/3 nonce with F16 KV",
      command: "bash scripts/serving/serve_vulkan.sh --model gemma-4-26B-A4B-it-UD-Q6_K_XL.gguf --reasoning off --cache-type-k f16 --cache-type-v f16",
      hermes: "max_tokens: 8192",
      rationale: "Verified plain-control baseline on Vulkan/RADV. Use it when GPU memory pressure matters, when you want concurrent loads — 26B-A4B + gpt-oss-120B fits where 31B + 120B does not — or when you want the simpler no-spec lane for general reasoning, JSON, and prose. The MTP comparison is opt-in code-speed work, not the default path."
    },
    'arrow': {
      name: "Qwen 3.6 27B Dense (UD-Q4_K_XL)",
      mode: "BREAK-GLASS — dense reasoning probe",
      file: "Qwen3.6-27B-UD-Q4_K_XL.gguf",
      size: "16.4 GB",
      speed: "9.6-11.5 tokens/sec normal decode; ~31 t/s with DFlash speculative",
      reasoning: "Either mode; coding gate held 3/3 think-on, 1/3 think-off",
      command: "bash scripts/serving/serve_rocm.sh --model Qwen3.6-27B-UD-Q4_K_XL.gguf",
      hermes: "max_tokens: 8192",
      rationale: "Experimental arrow in the quiver — community discussion often rates this model highly for reasoning, but local Strix Halo testing did not corroborate the routing choice: blind pairwise was 0-6 vs Qwen 122B on the standard 6-prompt set, and decode lagged the 35B workhorse across Vulkan, ROCm, and Lucebox HIP backends. Try when a different dense single-trace might unstick a blocked task. DFlash speculative decoding with a Q4_K_M draft lifts decode to ~31 t/s (2.82×); for Qwen 35B MoE, the current opt-in speed path is native MTP."
    }
  };

  function updateFinderResult() {
    let priVal = "code-fast";

    priorityRadios.forEach(radio => { if (radio.checked) priVal = radio.value; });

    const result = modelMatrix[priVal];

    if (result) {
      recModelName.textContent = result.name;
      recMode.textContent = result.mode;
      recFile.textContent = result.file;
      recSize.textContent = result.size;
      recSpeed.textContent = result.speed;
      recReasoning.textContent = result.reasoning;
      recCommand.textContent = result.command;
      recHermesConfig.textContent = result.hermes;
      recRationale.textContent = result.rationale;

      // Handle coloring badges based on mode
      recMode.className = "badge";
      recMode.classList.add('badge-blue');
    }
  }

  priorityRadios.forEach(radio => radio.addEventListener('change', updateFinderResult));

  // Initialize
  updateFinderResult();
}

/* ================= Benchmark Scatter Plot ================= */
function initBenchmarkChart() {
  const ctx = document.getElementById('benchmarkChart');
  if (!ctx) return;

  const benchModels = [
    { label: 'Qwen 35B Q4 MTP', decode: 81.2, prefill: null, intelligence: 43.5, coding: 35.2, source: 'AA Intelligence + AA Coding; local Tesla bench speed', tier: 'code-speed', color: '#115e59' },
    { label: 'Qwen 35B MTP', decode: 72.7, prefill: null, intelligence: 43.5, coding: 35.2, source: 'AA Intelligence + AA Coding; local Tesla bench speed', tier: 'code-speed', color: '#0f766e' },
    { label: 'Qwen 35B', decode: 58.5, prefill: 932.1, intelligence: 43.5, coding: 35.2, source: 'AA Intelligence + AA Coding; local Tesla bench speed', tier: 'workhorse', color: '#2b6cb0' },
    { label: 'gpt-oss 120B', decode: 46.0, prefill: null, intelligence: 33.3, coding: 28.6, source: 'AA Intelligence + AA Coding; local Tesla bench speed', tier: 'quality', color: '#14532d' },
    { label: 'Gemma 26B', decode: 44.8, prefill: 1002.8, intelligence: 27.1, coding: 29.1, source: 'AA non-reasoning Intelligence + Coding; local Tesla bench speed', tier: 'companion', color: '#2563eb' },
    { label: 'Qwen 122B MTP', decode: 28.3, prefill: 324.9, intelligence: 42.0, coding: 34.7, source: 'AA Intelligence + provider-surfaced AA Coding; local Tesla bench speed', tier: 'specialist', color: '#c2410c' },
    { label: 'StepFun 3.7 MTP', decode: 26.0, prefill: 211.2, intelligence: 43.0, coding: 56.3, source: 'AA Intelligence; StepFun SWE-Bench Pro proxy for coding; local Tesla bench speed', tier: 'large-contender', color: '#b45309' },
    { label: 'StepFun 3.7 plain', decode: 20.4, prefill: 212.0, intelligence: 43.0, coding: 56.3, source: 'AA Intelligence; StepFun SWE-Bench Pro proxy for coding; local Tesla bench speed', tier: 'large-contender', color: '#92400e' },
    { label: 'Qwen 122B', decode: 19.4, prefill: 136.0, intelligence: 42.0, coding: 34.7, source: 'AA Intelligence + provider-surfaced AA Coding; local Tesla bench speed', tier: 'specialist', color: '#7c2d12' },
    { label: 'Qwen 27B Dense', decode: 9.6, prefill: null, intelligence: 45.8, coding: 36.5, source: 'AA Intelligence + AA Coding; local Tesla bench speed', tier: 'experimental', color: '#7f1d1d' },
    { label: 'Gemma 31B', decode: 8.25, prefill: 133.6, intelligence: 39.2, coding: 38.7, source: 'AA reasoning Intelligence + Coding; local Tesla bench speed', tier: 'dense', color: '#553c7b' }
  ];

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: benchModels.map(model => model.label),
      datasets: [{
        label: 'Local decode tok/s',
        data: benchModels.map(model => model.decode),
        backgroundColor: benchModels.map(model => model.color),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: 'Model',
            color: '#4a5568',
            font: { family: 'Outfit', weight: 'bold' }
          },
          grid: { color: 'rgba(26, 31, 54, 0.08)' },
          ticks: { color: '#4a5568' }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Decode Speed (Tokens/Second)',
            color: '#4a5568',
            font: { family: 'Outfit', weight: 'bold' }
          },
          grid: { color: 'rgba(26, 31, 54, 0.08)' },
          ticks: { color: '#4a5568' }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#1a1f36', font: { family: 'Outfit' } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const model = benchModels[context.dataIndex];
              const prefill = model.prefill ? `; prefill ${model.prefill} tok/s` : '';
              return `${context.label}: ${model.decode} tok/s decode${prefill}`;
            }
          }
        }
      }
    }
  });

  const intelligenceCtx = document.getElementById('intelligenceChart');
  if (intelligenceCtx) {
    new Chart(intelligenceCtx, {
      type: 'scatter',
      data: {
        datasets: benchModels.map(model => ({
          label: model.label,
          data: [{ x: model.intelligence, y: model.decode }],
          pointRadius: model.tier === 'large-contender' ? 8 : 6,
          pointHoverRadius: 10,
          backgroundColor: model.color
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: 'Artificial Analysis Intelligence Index', color: '#4a5568', font: { family: 'Outfit', weight: 'bold' } },
            min: 25,
            max: 47,
            grid: { color: 'rgba(26, 31, 54, 0.08)' },
            ticks: { color: '#4a5568' }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Local Decode Speed (tok/s)', color: '#4a5568', font: { family: 'Outfit', weight: 'bold' } },
            grid: { color: 'rgba(26, 31, 54, 0.08)' },
            ticks: { color: '#4a5568' }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                const model = benchModels.find(entry => entry.label === context.dataset.label);
                return `${model.label}: intelligence ${model.intelligence}, coding ${model.coding}, local ${model.decode} tok/s`;
              }
            }
          }
        }
      }
    });
  }

  const codingCtx = document.getElementById('codingChart');
  if (codingCtx) {
    const codingModels = benchModels.filter(model => model.coding !== null);

    new Chart(codingCtx, {
      type: 'scatter',
      data: {
        datasets: codingModels.map(model => ({
          label: model.label,
          data: [{ x: model.coding, y: model.decode }],
          pointRadius: model.tier === 'large-contender' ? 8 : 6,
          pointHoverRadius: 10,
          backgroundColor: model.color
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: 'External Coding Score', color: '#4a5568', font: { family: 'Outfit', weight: 'bold' } },
            min: 20,
            max: 60,
            grid: { color: 'rgba(26, 31, 54, 0.08)' },
            ticks: { color: '#4a5568' }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Local Decode Speed (tok/s)', color: '#4a5568', font: { family: 'Outfit', weight: 'bold' } },
            grid: { color: 'rgba(26, 31, 54, 0.08)' },
            ticks: { color: '#4a5568' }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                const model = codingModels.find(entry => entry.label === context.dataset.label);
                return `${model.label}: coding ${model.coding}, local ${model.decode} tok/s; ${model.source}`;
              }
            }
          }
        }
      }
    });
  }

  const wallTimeCtx = document.getElementById('wallTimeChart');
  if (wallTimeCtx) {
    // measured: directly from full_bench.sh wall_std runs
    // estimated: 1150/pp + 2000/tg from speed data (same formula as full_bench.sh)
    const wallTimeModels = [
      { label: 'Qwen 35B Q4 MTP',    wallTime: 25.9,  measured: false, color: '#115e59' },
      { label: 'Qwen 35B MTP',        wallTime: 28.7,  measured: false, color: '#0f766e' },
      { label: 'Qwen 35B',            wallTime: 35.4,  measured: false, color: '#2b6cb0' },
      { label: 'Gemma 26B MTP',       wallTime: 42.0,  measured: true,  color: '#2563eb' },
      { label: 'Gemma 26B',           wallTime: 45.8,  measured: false, color: '#3b82f6' },
      { label: 'Qwen3-Coder-Next',    wallTime: 46.6,  measured: true,  color: '#0369a1' },
      { label: 'Qwen 122B MTP',       wallTime: 74.2,  measured: true,  color: '#c2410c' },
      { label: 'StepFun 3.7 MTP',     wallTime: 82.4,  measured: true,  color: '#b45309' },
      { label: 'StepFun 3.7 plain',   wallTime: 103.4, measured: true,  color: '#92400e' },
      { label: 'Qwen 122B',           wallTime: 111.5, measured: false, color: '#7c2d12' },
      { label: 'Gemma 31B MTP',       wallTime: 129.3, measured: true,  color: '#553c7b' },
    ].sort((a, b) => a.wallTime - b.wallTime);

    new Chart(wallTimeCtx, {
      type: 'bar',
      data: {
        labels: wallTimeModels.map(m => m.label),
        datasets: [{
          label: 'Wall time (seconds)',
          data: wallTimeModels.map(m => m.wallTime),
          backgroundColor: wallTimeModels.map(m => m.measured ? m.color : m.color + '88'),
          borderColor: wallTimeModels.map(m => m.measured ? 'transparent' : m.color),
          borderWidth: wallTimeModels.map(m => m.measured ? 0 : 1),
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            title: { display: true, text: 'Seconds (lower = faster)', color: '#4a5568', font: { family: 'Outfit', weight: 'bold' } },
            grid: { color: 'rgba(26, 31, 54, 0.08)' },
            ticks: { color: '#4a5568' }
          },
          y: {
            grid: { color: 'rgba(26, 31, 54, 0.04)' },
            ticks: { color: '#4a5568' }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                const m = wallTimeModels[context.dataIndex];
                const src = m.measured ? 'measured' : 'est. (1150/pp + 2000/tg)';
                return `${m.wallTime}s — ${src}`;
              }
            }
          }
        }
      }
    });
  }
}

/* ================= 11-Chapter Guide Logic ================= */
function initGuideTab() {
  const chapters = [
    { file: '01-what-is-agentic-ai.md', title: 'Chapter 1: What is Agentic AI?' },
    { file: '02-why-local.md', title: 'Chapter 2: Why Local?' },
    { file: '03-the-hardware.md', title: 'Chapter 3: The Hardware' },
    { file: '04-the-journey.md', title: 'Chapter 4: The Journey' },
    { file: '05-setup.md', title: 'Chapter 5: Setup' },
    { file: '06-verification.md', title: 'Chapter 6: Verification' },
    { file: '07-choosing-a-model.md', title: 'Chapter 7: Choosing a Model' },
    { file: '08-speed-and-tuning.md', title: 'Chapter 8: Speed and Tuning' },
    { file: '09-building-your-workflow.md', title: 'Chapter 9: Building Your Workflow' },
    { file: '10-orchestrating-agents.md', title: 'Chapter 10: Orchestrating Agents' },
    { file: '11-agent-safety.md', title: 'Chapter 11: Agent Safety' }
  ];

  const menuContainer = document.getElementById('guide-chapters-menu');
  const viewer = document.getElementById('guide-viewer');
  const spinner = document.getElementById('guide-content-loading');

  if (!menuContainer || !viewer) return;

  // Build the sidebar menu
  chapters.forEach((ch, idx) => {
    const btn = document.createElement('button');
    btn.className = 'guide-chapter-btn';
    if (idx === 0) btn.classList.add('active');
    btn.textContent = ch.title;
    btn.setAttribute('data-file', ch.file);

    btn.addEventListener('click', () => {
      document.querySelectorAll('.guide-chapter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadChapter(ch.file);
    });

    menuContainer.appendChild(btn);
  });

  // Load a chapter by filename
  async function loadChapter(fileName) {
    if (spinner) spinner.style.display = 'flex';
    viewer.style.opacity = '0.3';
    try {
      const response = await fetch(`./guide/${fileName}`);
      if (!response.ok) {
        throw new Error(`Failed to load chapter: ${response.statusText}`);
      }
      const markdownText = await response.text();
      
      // Parse markdown with marked
      if (typeof marked !== 'undefined') {
        viewer.innerHTML = marked.parse(markdownText);
      } else {
        viewer.innerHTML = `<pre>${markdownText}</pre>`;
      }
    } catch (error) {
      const errDiv = document.createElement('div');
      errDiv.className = 'card';
      errDiv.style.cssText = 'border-left:4px solid var(--color-danger); background-color:var(--color-danger-bg);';
      errDiv.innerHTML = '<h3>Error Loading Chapter</h3>';
      const p = document.createElement('p');
      p.textContent = error.message;
      errDiv.appendChild(p);
      viewer.replaceChildren(errDiv);
    } finally {
      if (spinner) spinner.style.display = 'none';
      viewer.style.opacity = '1';
      // Scroll display area back to top
      viewer.parentElement.scrollTop = 0;
    }
  }

  // Load the first chapter by default
  loadChapter(chapters[0].file);
}
