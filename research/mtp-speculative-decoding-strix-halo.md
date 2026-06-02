# MTP Self-Speculative Decoding on Strix Halo

This note records how the project evaluated the Qwen3.6-35B-A3B-MTP speedup on the reference Strix Halo box. It is a case study in vetting a community benchmark before turning it into public guidance.

## Summary

The community [strix-halo-guide](https://github.com/hogeheer499-commits/strix-halo-guide) by hogeheer499 surfaced the important lead: Qwen3.6-35B-A3B-MTP GGUFs can use llama.cpp's `--spec-type draft-mtp` path for self-speculative decoding. That path uses the model's native `nextn` head, so it does not load a separate draft model.

We reproduced the pipeline independently on the reference box. The Q4_K_M requant came out SHA-identical to the strix-halo-guide artifact, which gave us high confidence that we were testing the same model artifact and not a local one-off.

## Method

The evaluation flow was:

1. Reproduce the community build path with a recent llama.cpp tag (`b9360`) and current shaderc / `glslc`.
2. Requant the Q8_0 MTP source from `ggml-org/Qwen3.6-35B-A3B-MTP-GGUF` into the candidate quants.
3. Serve with `--spec-type draft-mtp --spec-draft-n-max 2 -ub 1024 --poll 100 -fa on` and F16 KV.
4. Gate the candidates on speed, nonce/tool discipline, coding behavior, and blind quality pairwise checks.
5. Keep the speed lanes that preserved the project quality bar; reject speed-first lanes that did not.

## Results

| Lane | Decode | vs MXFP4 workhorse (~58.5 t/s) | Quality result | Decision |
|---|---:|---:|---|---|
| MXFP4-MTP | ~72.7 t/s | +24% | same production quant | Ship as opt-in speed lane |
| Q4_K_M-MTP | ~81.2 t/s | +39% | won blind pairwise 4-2 | Ship as opt-in speed lane; human-check regulatory figures |
| IQ4_XS-Q8nextn | ~101 t/s community headline | speed-first | lost blind pairwise 0-6 vs production | Do not ship for this workflow |

The IQ4_XS result is not a criticism of the community guide. That guide presented it as a speed-first quant. This repo's target workload includes water-treatment and regulatory-adjacent writing, so the bar is different: speed is useful only after the model preserves enough accuracy for the workflow.

## Lesson

The earlier repo guidance said speculative decoding was counterproductive on MoE models. That was true for the old separate-draft / target-tensor paths we tested, where router verification overhead erased the win. The MTP path is scoped differently: the model artifact contains its own prediction head, and llama.cpp uses it directly.

So the lesson is narrower and more useful: speculative decoding is not "dead on MoE." It depends on the model artifact, quant, build, shader toolchain, and quality gate. For Qwen3.6-35B-A3B-MTP on Strix Halo, MTP is the real speed lever; simply updating llama.cpp without MTP did not speed up MXFP4 in our clean A/B.
