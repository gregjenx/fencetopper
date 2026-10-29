# Guided Builder: recommended approach

This describes the Builder in preview version 21. To try it, save an estimate in Shop and choose "Open my project".

## The model in one line

The Builder has two steps: **Project and runs**, then **Review and submit**. A short project overview sits above the runs. The customer answers each shared question once. Each run is then walked left to right, and the customer only describes what differs. Every gap is listed in one place, and nothing blocks saving or submitting.

## Project overview (above the runs)

Greg revised this on 2026-10-23 to cover only what most projects share. It no longer asks about the fence type, because configurations vary (galvanized posts are used on wood fences, for example).

Questions come one at a time. Each answered question collapses into a summary with a Change link. Tapping an option moves on to the next question, and questions you type into stay open until Next.

1. **Are the post extensions installed?** Choices: installed, planned but not installed, not decided, or my own design. This sets the measuring method:
   - installed: the gap between posts, edge to edge
   - everything else: center to center
2. **What do they mount on?** Choices: round metal posts, square metal posts, wood posts, or a top rail or wall, such as a concrete wall. Square posts and a rail or wall are tagged *We'll plan this with you*, because those installations aren't finalized.
3. **Extension shape and size.** Round or square, and the outside size. An optional list of recommended products for that mount fills in the size; for example, OZCO fills in Round 2 3/8 in. Each product is tagged *Proven fit* or *Needs planning*.
   - If the extension isn't decided, this question shows recommendations instead, plus "Ask us to recommend one" and "Decide later".
   - For a custom design, it adds a description, who designed it, whether it's installed, and uploads.
   - One size applies to the whole project. A post that differs is marked on its run.
4. **Topper color and height.** There's one color for the project. The customer either picks one height for every run, or says it varies and sets a height on each run.

## Step 2: Runs

- **The run list keeps the Shop runs.** Each run can be measured, renamed, duplicated, moved up or down, or deleted (delete needs a second tap). "Add a run" asks only for a rough length, which sets the starting number of posts.
- **Run walker.** A live drawing at the top fills in as measurements arrive. Unmeasured spans are dashed, "not sure" spans are amber, and posts that differ are outlined in rust. The steps run left to right:
  - The **left end post**: what's at this end (fence end, corner, gate, or wall), plus its size line, which reads "same as your other posts".
  - Each **span**: feet, inches and a quarter-inch fraction, with a "Not sure yet" option.
  - Each **middle post**: "This post is different" opens a size editor for that post only.
  - The **right end post**.
  - "Add a post here" sits between posts. Every middle post has a Remove button, and a middle-post counter adds or removes posts at the end. The measurement fields adjust automatically.
- **Totals.** The Builder converts gaps to a center-to-center length using the post sizes, and tells the customer it will use their measurements instead of the Shop estimate. The estimate updates live.
- **More for this run.** This section holds the height (only when it varies), a different extension for this run, photos (recommended, not required), notes, and a button to get help with the run.

## Step 3: Review and submit

- **Open items** come in two groups. "Needed before we can build" lists things like missing measurements, "not sure" spans, an undecided extension or unknown post sizes. "We'll review with you" covers needs-planning extensions, custom designs, and recommendation requests. Each item links to the place to fix it.
- **Consolidated review.** This shows the project answers, a drawing of each run, an expandable post-by-post table, photo counts, and notes.
- **Submitting** needs only a shipping address and a confirmation checkbox. Open items don't block it, and the open list is saved with the submission.
- The page says there's no payment now, and that payment follows design approval.

## Why this shape

- A homeowner at the fence answers about five taps of project questions, then types only gap measurements.
- Experts can skip around. The step tabs are always clickable, and "Go to your runs" is always available.
- Uncertainty never stops progress, but it always appears on the open list.
- Known solutions and review cases are tagged the same way everywhere: in setup, on runs, in review, and on the staff page.

## Preview limits

- Data is saved only in this browser.
- Uploads become small thumbnails stored on the device.
- Corner posts that join two runs aren't linked between runs yet.
- There's no slope or step handling yet.
