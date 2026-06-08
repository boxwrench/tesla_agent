# Stack Architecture Diagram

The diagram below illustrates how a user request flows through the local agentic AI stack on AMD Strix Halo hardware:

```mermaid
graph TD
    User["User Goal (e.g., Run SCADA QA Check)"] -->|Starts Agent| Hermes["Hermes Agent Engine (CLI / Profile)"]
    
    subgraph "Agent Loop (Hermes Sandbox)"
        Hermes -->|1. Generate Plan| LLM_API["OpenAI API Client"]
        LLM_API -->|Parse Response| Hermes
        Hermes -->|2. Select Tool| Tool_Router{"Tool Router"}
        Tool_Router -->|Run Command| Terminal["Terminal Execution Tool"]
        Tool_Router -->|Read/Write| FileSystem["Local Workspace Files"]
        Terminal -->|Execute Bash/Python| Sandbox["Isolated Docker Container"]
        Sandbox -->|Stdout / Stderr| Hermes
    end
    
    subgraph "Inference Server Layer"
        LLM_API <==>|HTTP /v1/chat/completions| LlamaServer["llama-server (b9247 Stable)"]
        LlamaServer -->|Quantized Model Weights| RAM_Model["Qwen / Gemma / gpt-oss GGUF models"]
    end
    
    subgraph "Driver &amp; Driver Settings"
        LlamaServer -->|Driver APIs| GPU_Driver["AMD GPU Driver Interface"]
        GPU_Driver -->|ROCm Path| ROCm["ROCm HIP Library (HSA_OVERRIDE_GFX_VERSION=11.5.1)"]
        GPU_Driver -->|Vulkan Path (Opt-In)| Vulkan["Mesa RADV Driver (HIP_VISIBLE_DEVICES=-1)"]
    end
    
    subgraph "Hardware Layer (Strix Halo APU)"
        ROCm -.->|Compute Kernels| APU["RDNA3.5 compute units (gfx1151)"]
        Vulkan -.->|Shader Execution| APU
        APU <==>|Shared Unified Memory| GTT["Graphics Translation Table (GTT Pool ~ 96 GB)"]
        GTT <==>|Physical RAM| SystemRAM["128 GB System RAM (UMA)"]
    end

    style Hermes fill:#0e2a35,stroke:#06b6d4,stroke-width:2px,color:#fff
    style LlamaServer fill:#1a233a,stroke:#3b82f6,stroke-width:2px,color:#fff
    style APU fill:#1b1535,stroke:#c084fc,stroke-width:2px,color:#fff
    style GTT fill:#152a22,stroke:#10b981,stroke-width:2px,color:#fff
```
