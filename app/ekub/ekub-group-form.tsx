import { EkubCycleFrequency, EkubPayoutMethod } from "@prisma/client";

export function EkubGroupForm({
  submitAction,
}: {
  submitAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={submitAction} className="card ekub-form-stack">
      <div className="ekub-form-grid">
        <label className="ekub-field">
          <span className="site-sidebar-label">Group Name</span>
          <input
            type="text"
            name="name"
            className="form-input"
            placeholder="Family Ekub"
            required
          />
        </label>

        <label className="ekub-field">
          <span className="site-sidebar-label">Contribution Amount</span>
          <input
            type="number"
            name="contributionAmount"
            className="form-input"
            min="1"
            step="0.01"
            placeholder="100"
            required
          />
        </label>

        <label className="ekub-field">
          <span className="site-sidebar-label">Cycle Frequency</span>
          <select
            name="cycleFrequency"
            className="form-input"
            defaultValue={EkubCycleFrequency.WEEKLY}
          >
            <option value={EkubCycleFrequency.WEEKLY}>Weekly</option>
            <option value={EkubCycleFrequency.MONTHLY}>Monthly</option>
          </select>
        </label>

        <label className="ekub-field">
          <span className="site-sidebar-label">Max Participants</span>
          <input
            type="number"
            name="maxParticipants"
            className="form-input"
            min="1"
            step="1"
            placeholder="10"
            required
          />
        </label>

        <label className="ekub-field">
          <span className="site-sidebar-label">Payout Method</span>
          <select
            name="payoutMethod"
            className="form-input"
            defaultValue={EkubPayoutMethod.FIXED_ROTATION}
          >
            <option value={EkubPayoutMethod.FIXED_ROTATION}>Fixed rotation</option>
            <option value={EkubPayoutMethod.RANDOM_DRAW}>Random draw</option>
          </select>
        </label>
      </div>

      <label className="ekub-field">
        <span className="site-sidebar-label">Description</span>
        <textarea
          name="description"
          className="form-textarea"
          rows={5}
          placeholder="What is this group for, how does it run, and what should members know?"
        />
      </label>

      <div className="toolbar" style={{ marginBottom: 0 }}>
        <button type="submit" className="submit-button">
          Create Ekub Group
        </button>
      </div>
    </form>
  );
}
