import {LitElement, css, html, nothing} from 'lit';
import './chromedash-callout';
import {ACTIVE_REVIEW_STATES} from './chromedash-gate-column';
import {GATE_TEAM_ORDER} from './form-field-enums';
import {findFirstFeatureStage} from './utils';
import {SHARED_STYLES} from '../sass/shared-css.js';


let preflightDialogEl;

export async function openPreflightDialog(
  feature, progress, process, action, stage, feStage, featureGates) {
  if (!preflightDialogEl) {
    preflightDialogEl = document.createElement('chromedash-preflight-dialog');
    document.body.appendChild(preflightDialogEl);
    await preflightDialogEl.updateComplete;
  }
  preflightDialogEl.openWithContext(
    feature, progress, process, action, stage, feStage, featureGates);
}


export function somePendingPrereqs(action, progress) {
  return action.prerequisites.some(
    itemName => !progress.hasOwnProperty(itemName));
}

export function somePendingGates(featureGates, feStage) {
  return findPendingGates(featureGates, feStage).length > 0;
}


function findPendingGates(featureGates, feStage) {
  const gatesForStage = featureGates.filter(g => g.stage_id == feStage.id);
  const otherGates = gatesForStage.filter(g => g.team_name != 'API Owners');
  const pendingGates = otherGates.filter(g =>
    ACTIVE_REVIEW_STATES.includes(g.state));
  pendingGates.sort((g1, g2) =>
    GATE_TEAM_ORDER.indexOf(g1.team_name) -
      GATE_TEAM_ORDER.indexOf(g2.team_name));
  return pendingGates;
}


export class ChromedashPreflightDialog extends LitElement {
  static get properties() {
    return {
      feature: {type: Object},
      featureGates: {type: Array},
      progress: {type: Object},
      process: {type: Object},
      action: {type: Object},
      stage: {type: Object},
      feStage: {type: Object},
      progress: {type: Object},
    };
  }

  constructor() {
    super();
    this.feature = null;
    this.featureGates = null;
    this.progress = null;
    this.process = null;
    this.action = null;
    this.stage = null;
    this.feStage = null;
    this.progress = null;
  }

  static get styles() {
    return [
      ...SHARED_STYLES,
      css`
      ol {
        list-style: none;
        padding: 0;
      }

      ol li {
        margin-top: .5em;
      }

      .missing-prereqs-list {
        padding-bottom: 1em;
      }

      .missing-prereqs-list li {
        list-style: circle;
        margin-left: 2em;
      }

      .edit-progress-item {
        visibility: hidden;
        margin-left: var(--content-padding-half);
      }

      .active .edit-progress-item,
      .missing-prereqs .edit-progress-item,
      .pending:hover .edit-progress-item,
      .done:hover .edit-progress-item {
        visibility: visible;
      }
    `];
  }

  openWithContext(
    feature, progress, process, action, stage, feStage, featureGates) {
    this.feature = feature;
    this.progress = progress;
    this.process = process;
    this.action = action;
    this.stage = stage;
    this.feStage = feStage;
    this.featureGates = featureGates;
    this.shadowRoot.querySelector('sl-dialog').show();
  }

  closeDialog() {
    this.shadowRoot.querySelector('sl-dialog').hide();
  }

  renderEditLink(stage, feStage, pi) {
    if (pi.field && stage && feStage) {
      return html`
        <a class="edit-progress-item"
           href="/guide/stage/${this.feature.id}/${stage.outgoing_stage}/${feStage.id}#id_${pi.field}"
           @click=${this.closeDialog}>
          Edit
        </a>
      `;
    }
    return nothing;
  }

  makePrereqItem(itemName) {
    for (const s of (this.process.stages || [])) {
      for (const pi of s.progress_items) {
        if (itemName == pi.name) {
          return {...pi, stage: s};
        }
      }
    }
    throw new Error('prerequiste is not a defined progress item');
  }

  renderDialogContent() {
    if (this.feature == null) {
      return nothing;
    }
    const prereqItems = [];
    for (const itemName of (this.action.prerequisites || [])) {
      if (!this.progress.hasOwnProperty(itemName)) {
        prereqItems.push(this.makePrereqItem(itemName));
      }
    }
    const pendingGates = findPendingGates(this.featureGates, this.feStage);

    const url = this.action.url
      .replace('{feature_id}', this.feature.id)
      .replace('{outgoing_stage}', this.stage.outgoing_stage);

    return html`
      Before you ${this.action.name}, you should first do the following:
      <ol class="missing-prereqs-list">
        ${prereqItems.map((item) => html`
        <li class="pending">
          ${item.stage.name}:
          ${item.name}
          ${this.renderEditLink(
              item.stage,
              findFirstFeatureStage(
                item.stage.outgoing_stage, this.stage, this.feature),
              item)}
        </li>`)}
      </ol>

      <p>Pending gates:</p>
      <ol>
      ${pendingGates.map(g => g.team_name)}
      </ol>
      <sl-button href="${url}" target="_blank" variant="primary" size="small">
        Proceed to Draft Email
      </sl-button>
    `;
  }

  render() {
    return html`
      <sl-dialog class="missing-prereqs"
        label="Missing Prerequisites"
        style="--width:fit-content">
        ${this.renderDialogContent()}
      </sl-dialog>
    `;
  }
};

customElements.define('chromedash-preflight-dialog', ChromedashPreflightDialog);
