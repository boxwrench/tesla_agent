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
      name: "Qwen 3.6 35B MoE (MXFP4) or Gemma 4 31B IT (Q6_K)",
      mode: "CODE Baseline + Gemma Peer",
      file: "Qwen3.6-35B-A3B-MXFP4_MOE.gguf",
      size: "21.7 GB baseline; 25.2 GB Gemma peer",
      speed: "Qwen 35B: 50.1 t/s; Gemma 31B: 43-48 t/s",
      reasoning: "Uncapped for coding; use orchestrated steps for Gemma 31B",
      command: "bash scripts/serving/serve_vulkan.sh",
      hermes: "max_tokens: 8192",
      rationale: "Qwen 3.6 35B remains the compact CODE/general baseline: fast, repeatedly gate-clean, and broadly useful. Gemma 4 31B IT is the cross-family CODE peer after clearing nonce and orchestrated coding gates. Do not cap reasoning on stateful coding tasks; use staged/orchestrated steps when a single long episode degrades."
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
      name: "gpt-oss-120B (MXFP4, 3 shards)",
      mode: "QUALITY Baseline",
      file: "gpt-oss-120b-mxfp4-0000{1..3}-of-00003.gguf",
      size: "~63 GB",
      speed: "~46 tokens/sec (Vulkan/RADV)",
      reasoning: "High reasoning with draft-with-assumptions prompt",
      command: "Configure the local server for the gpt-oss-120B shard set",
      hermes: "max_tokens: 8192\nsystem prompt: draft with labeled assumptions",
      rationale: "The newest local pairwise battery makes gpt-oss-120B the general quality baseline: 5-1 vs Qwen 35B and 4-2 vs Qwen 122B after the prompt stopped checklist deflection. Keep Qwen 122B available as a spot-specialist for regulatory-currency tasks and incisive plan reviews."
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

  // Decode speed leaderboard. Quality evidence is shown in the benchmark table.
  const chartData = {
    labels: [
      'Qwen 35B',
      'gpt-oss 120B',
      'Gemma 31B',
      'Gemma 26B-A4B',
      'Qwen3-Coder',
      'Qwen 122B',
      'Qwen 27B Dense'
    ],
    datasets: [{
      label: 'Decode tok/s',
      data: [50.1, 46, 43, 40.11, 34.6, 19.4, 9.6],
      backgroundColor: ['#2b6cb0', '#14532d', '#3182ce', '#718096', '#718096', '#7c2d12', '#7f1d1d'],
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
              const speedLabels = ['50.1', '~46', '43-48', '40.11 mean', '34.6', '19.4', '9.6-11.5'];
              return `${context.label}: ${speedLabels[context.dataIndex]} tok/s`;
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
