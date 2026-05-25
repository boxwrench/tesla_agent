/* ==============================================================================
   app.js — Interactive Client Logic for teslaagent Web Dashboard
   ============================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initSetupStepper();
  initModelFinder();
  initBenchmarkChart();
  initLogVerifier();
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
  const ramRadios = document.querySelectorAll('input[name="finder-ram"]');
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
    // === 128 GB Setup (MoE support) ===
    '128-code': {
      name: "Qwen 3.6 35B Mixture-of-Experts (MXFP4 Quant)",
      mode: "Reasoning Enabled",
      file: "Qwen3.6-35B-A3B-MXFP4_MOE.gguf",
      size: "21.7 GB",
      speed: "~44.2 tokens/sec (ROCm default, up to ~52 t/s Vulkan)",
      reasoning: "Gated reasoning cap (256-512 tokens recommended)",
      command: "bash scripts/serving/serve_rocm.sh",
      hermes: "thinking_budget_tokens: 512\nmax_tokens: 8192",
      rationale: "This configuration provides the best balance of multi-step coding reasoning and speed on a 128GB APU system. Flash attention is enabled by default to handle context. Capping reasoning tokens via 'thinking_budget_tokens' ensures fast loops."
    },
    '128-extract': {
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
    '128-synthesis': {
      name: "Qwen 3.5 122B Mixture-of-Experts (MXFP4 Quant)",
      mode: "High-Quality Synthesis",
      file: "Qwen3.5-122B-A10B-MXFP4_MOE.gguf",
      size: "70.0 GB (fits GTT memory limits)",
      speed: "~16.5 tokens/sec (ROCm server)",
      reasoning: "Deep reasoning active",
      command: "bash scripts/serving/serve_rocm.sh --model ~/models/Qwen3.5-122B-A10B-MXFP4_MOE.gguf --ctx-size 8192",
      hermes: "thinking_budget_tokens: 1024\nmax_tokens: 8192",
      rationale: "When writing formal EPA compliance reports, accuracy and synthesis quality are critical. The 122B MoE model provides unmatched instruction following. Context size must be capped at 8192 to prevent graphics driver spillover hangs."
    },
    // === 64 GB Setup (Dense models only) ===
    '64-code': {
      name: "Qwen 3.6 27B Coder (Q4_K_M Quant)",
      mode: "Coding Active",
      file: "Qwen3.6-27B-Q4_K_M.gguf",
      size: "18.2 GB",
      speed: "~41.0 tokens/sec",
      reasoning: "Gated reasoning cap (256)",
      command: "bash scripts/serving/serve_rocm.sh --model ~/models/Qwen3.6-27B-Q4_K_M.gguf",
      hermes: "thinking_budget_tokens: 256\nmax_tokens: 8192",
      rationale: "A 64GB RAM system has insufficient context buffer headroom for large MoE models. The 27B dense model fits easily and provides solid multi-step tool-calling capability."
    },
    '64-extract': {
      name: "Qwen 3.6 7B Coder (Q6_K Quant)",
      mode: "Fast Check & Extraction",
      file: "Qwen3.6-7B-Q6_K.gguf",
      size: "5.8 GB",
      speed: "~72.0 tokens/sec",
      reasoning: "Disabled",
      command: "bash scripts/serving/serve_rocm.sh --model ~/models/Qwen3.6-7B-Q6_K.gguf --ctx-size 16384",
      hermes: "thinking_budget_tokens: 0\nmax_tokens: 2048",
      rationale: "A lightweight, extremely fast model for simple data mapping and format validation. Running at 7B footprint leaves ample RAM for other host processes."
    },
    '64-synthesis': {
      name: "Qwen 3.6 27B Coder (Q6_K Quant)",
      mode: "Standard Dense Synthesis",
      file: "Qwen3.6-27B-Q6_K.gguf",
      size: "24.4 GB",
      speed: "~35.0 tokens/sec",
      reasoning: "Reasoning active",
      command: "bash scripts/serving/serve_rocm.sh --model ~/models/Qwen3.6-27B-Q6_K.gguf --ctx-size 16384",
      hermes: "thinking_budget_tokens: 512\nmax_tokens: 4096",
      rationale: "For report synthesis on a 64GB RAM system, the 27B Q6 quant provides high semantic accuracy without risking GTT memory crashes."
    }
  };

  function updateFinderResult() {
    let ramVal = "128";
    let priVal = "code";

    ramRadios.forEach(radio => { if (radio.checked) ramVal = radio.value; });
    priorityRadios.forEach(radio => { if (radio.checked) priVal = radio.value; });

    const configKey = `${ramVal}-${priVal}`;
    const result = modelMatrix[configKey];

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
      if (result.mode.includes("Disabled") || result.mode.includes("Extraction")) {
        recMode.classList.add('badge-blue');
      } else {
        recMode.classList.add('badge-blue'); // Default blue
      }
    }
  }

  ramRadios.forEach(radio => radio.addEventListener('change', updateFinderResult));
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
          { x: 44.2, y: 82, label: 'Qwen 3.6 35B MoE (Think-On)' },
          { x: 43.7, y: 82, label: 'Qwen 3.6 35B MoE (Think-Off)' },
          { x: 47.3, y: 79, label: 'Qwen 3.5 35B MoE (Think-On)' },
          { x: 16.5, y: 84, label: 'Qwen 3.5 122B MoE (Think-On)' }
        ],
        backgroundColor: '#06b6d4', // Cyan
        pointRadius: 8,
        pointHoverRadius: 10
      },
      {
        label: 'Dense Models / Competitors',
        data: [
          { x: 42.5, y: 76, label: 'Qwen 3 Coder 30B (Failed Gate)' },
          { x: 41.0, y: 77, label: 'Standard Coder 27B' }
        ],
        backgroundColor: '#9ca3af', // Gray
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
            color: '#9ca3af',
            font: { family: 'Outfit', weight: 'bold' }
          },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af' }
        },
        y: {
          min: 70,
          max: 86,
          title: {
            display: true,
            text: 'Quality Score (Scorecard Rubric / 84)',
            color: '#9ca3af',
            font: { family: 'Outfit', weight: 'bold' }
          },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af' }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#f3f4f6', font: { family: 'Outfit' } }
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

/* ================= Nonce Gate Log Verifier ================= */
function initLogVerifier() {
  const btnVerify = document.getElementById('btn-verify-logs');
  const inputNonce = document.getElementById('input-nonce');
  const inputLog = document.getElementById('input-log');
  
  const verifierOutput = document.getElementById('verifier-output');
  
  const cardC1 = document.getElementById('card-c1');
  const cardC2 = document.getElementById('card-c2');
  const cardC3 = document.getElementById('card-c3');
  
  const iconC1 = document.getElementById('icon-c1');
  const iconC2 = document.getElementById('icon-c2');
  const iconC3 = document.getElementById('icon-c3');
  
  const descC1 = document.getElementById('desc-c1');
  const descC2 = document.getElementById('desc-c2');
  const descC3 = document.getElementById('desc-c3');
  
  const verSummary = document.getElementById('ver-summary');

  btnVerify.addEventListener('click', () => {
    const nonce = inputNonce.value.trim();
    const logText = inputLog.value.trim();

    if (!nonce) {
      alert("Please enter the expected Nonce token first.");
      return;
    }
    if (!logText) {
      alert("Please paste the agent response log text to verify.");
      return;
    }

    // Run tests
    
    // Criterion 1: Structured tool call check
    // We check if the text mentions calling the terminal tool or contains tool_calls structure
    const hasToolCallMarker = logText.toLowerCase().includes('"tool_calls"') || 
                             logText.toLowerCase().includes('"finish_reason": "tool_calls"') ||
                             logText.toLowerCase().includes('terminal(') ||
                             logText.toLowerCase().includes('calling tool') ||
                             logText.toLowerCase().includes('running terminal');

    // Criterion 2: Nonce echoed in the text
    const hasNonce = logText.includes(nonce);

    // Criterion 3: No fenced blocks (```bash or ```sh or ``` with cat commands)
    const hasFencedShell = /```\s*(bash|sh|shell|zsh|console)\b/i.test(logText) || 
                           (logText.includes('```') && (
                             logText.includes('cat ') || 
                             logText.includes('less ') || 
                             logText.includes('read ') || 
                             logText.includes('head ')
                           ));

    // Update UI elements based on checks
    
    // C1: Tool Call
    if (hasToolCallMarker) {
      cardC1.className = "result-card passed";
      iconC1.className = "fa-solid fa-circle-check rc-icon";
      descC1.innerHTML = "<strong>PASS</strong>: Structured tool call detected in the logs.";
    } else {
      cardC1.className = "result-card failed";
      iconC1.className = "fa-solid fa-circle-xmark rc-icon";
      descC1.innerHTML = "<strong>FAIL</strong>: The agent printed a direct answer without issuing a tool call command.";
    }

    // C2: Nonce Echo
    if (hasNonce) {
      cardC2.className = "result-card passed";
      iconC2.className = "fa-solid fa-circle-check rc-icon";
      descC2.innerHTML = `<strong>PASS</strong>: Nonce token <code>${nonce}</code> was successfully read and output.`;
    } else {
      cardC2.className = "result-card failed";
      iconC2.className = "fa-solid fa-circle-xmark rc-icon";
      descC2.innerHTML = `<strong>FAIL</strong>: Nonce token <code>${nonce}</code> was not found in the response body.`;
    }

    // C3: Fenced block
    if (!hasFencedShell) {
      cardC3.className = "result-card passed";
      iconC3.className = "fa-solid fa-circle-check rc-icon";
      descC3.innerHTML = "<strong>PASS</strong>: No fenced code blocks or raw shell scripts printed in output text.";
    } else {
      cardC3.className = "result-card failed";
      iconC3.className = "fa-solid fa-circle-xmark rc-icon";
      descC3.innerHTML = "<strong>FAIL</strong>: Found fenced code blocks (e.g. ```bash). The model printed commands rather than executing them.";
    }

    // Show Results Panel
    verifierOutput.style.display = "block";
    
    // Final Summary state
    const allPassed = hasToolCallMarker && hasNonce && !hasFencedShell;
    if (allPassed) {
      verSummary.className = "ver-summary-box passed";
      verSummary.innerHTML = '<i class="fa-solid fa-circle-check"></i> Nonce Gate CLEARED (3/3 Criteria Passed)';
    } else {
      verSummary.className = "ver-summary-box failed";
      verSummary.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Nonce Gate FAILED (Fix highlighted errors)';
    }

    // Scroll to results smoothly
    verifierOutput.scrollIntoView({ behavior: 'smooth' });
  });
}
