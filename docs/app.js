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
      speed: "~50.1 tokens/sec (Vulkan/RADV; ~44.2 t/s ROCm fallback)",
      reasoning: "Uncapped think-on — do NOT budget the coding route",
      command: "bash scripts/serving/serve_vulkan.sh",
      hermes: "max_tokens: 8192",
      rationale: "First reach for any coding or multi-step agent task. Best balance of reasoning quality and speed on a 128 GB APU (82/84 rubric, 3/3 nonce gate). Vulkan/RADV is the promoted backend (+51% prefill, +13.5% decode over ROCm); ROCm is the fallback. A budget sweep showed any reasoning cap drops the stateful coding gate to 1-2/3 while uncapped think-on holds 3/3 — reasoning budgets are a planning latency lever, not a coding one."
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
      rationale: "Cross-family second opinion when a single long coding episode degrades, or for tasks where Qwen's style has plateaued. Cleared nonce 3/3 (think-off and think-on) and orchestrated coding 3/3 E2E; the orchestrated/staged path is what graduated, not single-episode. Won 4-2 quality pairwise vs Gemma 4 26B-A4B. SPEED NOTE: Gemma 31B is a dense model — every token reads all 31B parameters. Decode is ~8 tok/s, far slower than Qwen 35B MoE (~50 tok/s) or gpt-oss-120B (~46 tok/s). Prefill is fast (~133.6 tok/s pp8192). Use on the orchestrated path for quality verification, not as a speed-first workhorse."
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
      name: "Qwen 3.5 122B-A10B (MXFP4)",
      mode: "SYNTHESIS — regulatory specialist",
      file: "Qwen3.5-122B-A10B-MXFP4_MOE.gguf",
      size: "70.0 GB (fits GTT memory limits at ctx 12,288)",
      speed: "~19.4 tokens/sec (ROCm)",
      reasoning: "Deep reasoning active; think-off variant holds the coding gate 3/3",
      command: "bash scripts/serving/serve_rocm.sh --model ~/models/Qwen3.5-122B-A10B-MXFP4_MOE.gguf --ctx-size 12288",
      hermes: "thinking_budget_tokens: 1024\nmax_tokens: 8192",
      rationale: "Reserved as a QUALITY spot-specialist after gpt-oss-120B took the general baseline. Reach for it on regulatory-currency tasks (EPA April-2024 PFAS NPDWR framing, state DEQ rule synthesis) and incisive plan reviews where the 122B's wider knowledge base earns its decode cost. 80-81/84 rubric, 3/3 nonce."
    },
    'companion': {
      name: "Gemma 4 26B-A4B IT (UD-Q6_K_XL)",
      mode: "COMPANION — small-footprint MoE",
      file: "gemma-4-26B-A4B-it-UD-Q6_K_XL.gguf",
      size: "21.2 GB",
      speed: "~40.11 tokens/sec mean (Vulkan/RADV) [Not verified in public repo]",
      reasoning: "Off in tested gate (think-on variant also cleared nonce 3/3)",
      command: "bash scripts/serving/serve_vulkan.sh --model gemma-4-26B-A4B-it-UD-Q6_K_XL.gguf --cache-type-k f16 --cache-type-v f16",
      hermes: "max_tokens: 8192",
      rationale: "Cleared the coding gate (nonce 3/3, orchestrated pass^3) but did NOT graduate to the Stable Stack based on quality pairwise (2-4 loss to Gemma 31B). Use case: when GPU memory pressure matters and you want concurrent loads — 26B-A4B + gpt-oss-120B fits where 31B + 120B does not. Also a step-1 file-analysis fallback for prompts where 31B's empty-exceedances bug recurs (orchestrated coding step 1 PASSed across all four runs). Speed note: 40.11 tok/s was reported in source benchmarks but has not been independently verified in the public repo."
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
      rationale: "Experimental arrow in the quiver — community discussion often rates this model highly for reasoning, but local Strix Halo testing did not corroborate the routing choice: blind pairwise was 0-6 vs Qwen 122B on the standard 6-prompt set, and decode lagged the 35B workhorse across Vulkan, ROCm, and Lucebox HIP backends. Try when a different dense single-trace might unstick a blocked task. DFlash speculative decoding with a Q4_K_M draft lifts decode to ~31 t/s (2.82×) — the inverse of the MoE speculative result, because a dense model has no expert router to thrash."
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

  // Decode speed leaderboard. Quality evidence is shown in the benchmark table.
  const chartData = {
    labels: [
      'Qwen 35B',
      'gpt-oss 120B',
      'Qwen3-Coder',
      'Qwen 122B',
      'Qwen 27B Dense',
      'Gemma 31B (dense)'
    ],
    datasets: [{
      label: 'Decode tok/s',
      data: [50.1, 46, 34.6, 19.4, 9.6, 8.25],
      backgroundColor: ['#2b6cb0', '#14532d', '#718096', '#7c2d12', '#7f1d1d', '#553c7b'],
      borderRadius: 6
    }]
  };

  new Chart(ctx, {
    type: 'bar',
    data: chartData,
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
              const speedLabels = ['50.1', '~46', '34.6', '19.4', '9.6-11.5', '~8.25 tg128 (dense)'];
              return `${context.label}: ${speedLabels[context.dataIndex]} tok/s`;
            }
          }
        }
      }
    }
  });
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
      viewer.innerHTML = `<div class="card" style="border-left:4px solid var(--color-danger); background-color:var(--color-danger-bg);">
        <h3>Error Loading Chapter</h3>
        <p>${error.message}</p>
      </div>`;
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
