# Membrane-Fouling Prompt

## The Request

> I have a historian slice at `<DATA_PATH>` with stage-3 membrane/filter
> instruments `DPIT-301` and `FIT-301`.
>
> Please assess whether this window shows a fouling trend that would matter
> operationally. Write a short operator-facing answer and save any supporting
> chart to `/out`.
>
> Also provide `/out/answers.json` with this shape:
>
> ```json
> {
>   "dpit_slope_per_day": 0.0,
>   "normalized_dpit_slope_per_day": 0.0,
>   "fit_mean": 0.0,
>   "dpit_change_pct": 0.0,
>   "fouling_detected": true
> }
> ```

## Grading Notes

The request names the tags and asks for a fouling assessment, but does
not prescribe the exact method. The JSON exists only to make numeric
grading auditable.
