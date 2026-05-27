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

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');

      // Update Navigation buttons
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Update Tab Contents
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `tab-${targetTab}`) {
          content.classList.add('active');
        }
      });

      // Update Title
      if (pageTitle) {
        pageTitle.textContent = item.textContent.trim();
      }
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
    'code': {
      name: "Qwen 3.6 35B Mixture-of-Experts (MXFP4 Quant)",
      mode: "Reasoning Enabled (Uncapped)",
      file: "Qwen3.6-35B-A3B-MXFP4_MOE.gguf",
      size: "21.7 GB",
      speed: "~50.1 tokens/sec (Vulkan/RADV default; ~44.2 t/s ROCm fallback)",
      reasoning: "Uncapped think-on — do NOT budget the coding route",
      command: "bash scripts/serving/serve_vulkan.sh",
      hermes: "max_tokens: 8192",
      rationale: "Best balance of multi-step coding reasoning and speed on a 128GB APU. The Vulkan/RADV backend is the promoted default (+51% prefill, +13.5% decode over ROCm); ROCm is the fallback. IMPORTANT: do not cap reasoning on coding tasks — a budget sweep showed any cap drops the stateful coding gate to 1-2/3, while uncapped think-on holds 3/3. Reasoning budgets are a planning/prose latency lever, not a coding one."
    },
    'extract': {
      name: "Qwen 3.6 35B Mixture-of-Experts (MXFP4 Quant)",
      mode: "Reasoning Disabled (Pure Extraction)",
      file: "Qwen3.6-35B-A3B-MXFP4_MOE.gguf",
      size: "21.7 GB",
      speed: "~43.7 tokens/sec (Faster wall-time by avoiding reasoning decode)",
      reasoning: "Disabled via template parameters (enable_thinking: false)",
      command: "bash scripts/serving/serve_rocm.sh --jinja --chat-template-kwargs '{\"enable_thinking\":false}'",
      hermes: "thinking_budget_tokens: 0\nmax_tokens: 4096",
      rationale: "Simple telemetry extraction and log parsing do not require reasoning outputs. Disabling thinking using the template keyword parameters saves 50%+ wall-clock time and guarantees tool-use functions run directly. Note that --reasoning-budget 0 is broken and must not be used."
    },
    'synthesis': {
      name: "Qwen 3.5 122B Mixture-of-Experts (MXFP4 Quant)",
      mode: "High-Quality Synthesis",
      file: "Qwen3.5-122B-A10B-MXFP4_MOE.gguf",
      size: "70.0 GB (fits GTT memory limits)",
      speed: "~19.4 tokens/sec (ROCm server)",
      reasoning: "Deep reasoning active",
      command: "bash scripts/serving/serve_rocm.sh --model ~/models/Qwen3.5-122B-A10B-MXFP4_MOE.gguf --ctx-size 12288",
      hermes: "thinking_budget_tokens: 1024\nmax_tokens: 8192",
      rationale: "When drafting formal master-plan reports and research syntheses, accuracy and instruction-following quality matter most. The 122B MoE provides the strongest synthesis on this hardware. Context is capped (8k-12k) to keep allocations inside the GTT pool and prevent graphics-driver spillover hangs."
    }
  };

  function updateFinderResult() {
    let priVal = "code";

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

  // Datasets mapping: X = Speed (t/s), Y = Quality Score (out of 84)
  const chartData = {
    datasets: [
      {
        label: 'Mixture of Experts (MoE)',
        data: [
          { x: 50.1, y: 82, label: 'Qwen 3.6 35B MoE (Vulkan, Think-On) — default' },
          { x: 44.2, y: 82, label: 'Qwen 3.6 35B MoE (ROCm, Think-On)' },
          { x: 43.7, y: 82, label: 'Qwen 3.6 35B MoE (Think-Off)' },
          { x: 47.3, y: 79, label: 'Qwen 3.5 35B MoE (Think-On)' },
          { x: 19.4, y: 80, label: 'Qwen 3.5 122B MoE (Think-On)' }
        ],
        backgroundColor: '#2b6cb0', // Primary Accent Blue
        pointRadius: 8,
        pointHoverRadius: 10
      },
      {
        label: 'Other Models',
        data: [
          { x: 34.6, y: 76, label: 'Qwen3-Coder-Next (3/3 Pass, CODE challenger)' }
        ],
        backgroundColor: '#718096', // Neutral Grey
        pointRadius: 6,
        pointHoverRadius: 8
      }
    ]
  };

  new Chart(ctx, {
    type: 'scatter',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: 'Generation Speed (Tokens/Second)',
            color: '#4a5568',
            font: { family: 'Outfit', weight: 'bold' }
          },
          grid: { color: 'rgba(26, 31, 54, 0.08)' },
          ticks: { color: '#4a5568' }
        },
        y: {
          min: 70,
          max: 86,
          title: {
            display: true,
            text: 'Quality Score (Scorecard Rubric / 84)',
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
              const point = context.raw;
              return `${point.label}: Speed=${point.x} t/s, Quality=${point.y}/84`;
            }
          }
        }
      }
    }
  });
}

/* ================= 10-Chapter Guide Logic ================= */
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
    { file: '10-orchestrating-agents.md', title: 'Chapter 10: Orchestrating Agents' }
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


