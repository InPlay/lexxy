# InPlay's Lexxy branch

The `inplay-extensions` branch is upstream Lexxy (basecamp/lexxy `main`) with these changes on top:

1. `lexxy.gemspec` requires `railties >= 7.2` instead of `>= 8.0.2`, so a Rails 7.2 app can bundle it.
2. `TextAlignmentExtension` (`src/extensions/text_alignment_extension.js`): the `alignLeft`, `alignCenter`, `alignRight` and `alignJustify` toolbar commands, `aria-pressed` on the `[name=align-*]` toolbar buttons, and `text-align` kept in the editor's value.
3. `AttachmentLayoutExtension` (`src/extensions/attachment_layout_extension.js`): a resize handle and left/center/right buttons on images and previewable files outside galleries, saved as the attachment's `width` and `data-alignment`.
4. Both extensions exported from `src/index.js`, with a Vitest test for the image layout round trip.
5. This file.
6. The built `app/assets/javascript/lexxy.js` and `lexxy.js.map`, committed so that bundling the gem does not need node or yarn. The rest of `app/assets/javascript/` stays ignored.

Both extensions are opt-in. Without them registered, the editor behaves as upstream's.

The branch was cut from upstream `main` at `75cc141d4aa074d759196765ca227ba98c5c52f0`. The build was made with node v26.8.1 and yarn 1.22.22.

## How InPlay registers the extensions

InPlay imports `lexxy.js` from its digested asset URL, so the page has one instance of the module, and calls `configure` once, in the same module:

```js
import { configure, TextAlignmentExtension, AttachmentLayoutExtension } from "/assets/lexxy-<digest>.js"

configure({ global: { extensions: [ TextAlignmentExtension, AttachmentLayoutExtension ] } })
```

It keeps upstream's default headings (`h2`, `h3`, `h4`): InPlay's format select labels them H1, H2 and H3, as its old editor did.

`configure` replaces arrays rather than appending to them, so a second call with `extensions` would drop the first call's list.

InPlay's server must also allow `data-alignment` on attachments (`ActionText::ContentHelper.allowed_attributes` and `ActionText::Attachment::ATTRIBUTES`); the gem does not add it.

## Pulling upstream changes

A rebase rewrites every commit on the branch, and InPlay's `Gemfile.lock` pins one of those commits by sha. Bundler can only check out a pinned sha that a branch on this remote still contains, so never amend, force-push or delete a branch holding a pinned sha. Each pull goes to a new branch instead:

1. Add basecamp/lexxy as the `upstream` remote if the clone lacks it (`git remote add upstream https://github.com/basecamp/lexxy.git`). Run `git fetch --multiple origin upstream`, then `git checkout -b inplay-extensions-<yyyy-mm-dd> origin/<branch>`, where `<branch>` is the one InPlay's Gemfile names now.
2. `git rebase upstream/main`. Keep every commit: upstream ignores the built files, so the build commits replay without conflicts, and the first of them also carries the `.gitignore` exception that lets the built files be committed. Step 3 replaces their stale output.
3. `yarn install && yarn build`, then commit `app/assets/javascript/lexxy.js` and `lexxy.js.map` as a new build commit.
4. Update the upstream sha and the node and yarn versions in this file, and commit.
5. `git push -u origin inplay-extensions-<yyyy-mm-dd>`.
6. In InPlay, point the Gemfile's `branch:` at the new branch and run `bundle update lexxy --conservative`, so only the lexxy entry in `Gemfile.lock` changes.
7. In InPlay, run `lib/scripts/catalog_render_snapshot.rb` with `before` on the old lockfile and `after` on the new one, as its header shows; `diff -r` of the two directories must be empty. Then run `spec/acceptance/oscar/admin_manages_catalog_pages_spec.rb`.

A rebuild without a rebase (for example after changing an extension) is a new build commit on the current branch, pushed normally.
