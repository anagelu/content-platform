import { EkubParticipantStatus } from "@prisma/client";

export function EkubParticipantForm({
  groupId,
  submitAction,
}: {
  groupId: number;
  submitAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={submitAction} className="card ekub-form-stack">
      <input type="hidden" name="groupId" value={groupId} />

      <div className="ekub-form-grid">
        <label className="ekub-field">
          <span className="site-sidebar-label">Participant Name</span>
          <input
            type="text"
            name="name"
            className="form-input"
            placeholder="Aster"
            required
          />
        </label>

        <label className="ekub-field">
          <span className="site-sidebar-label">Email</span>
          <input
            type="email"
            name="email"
            className="form-input"
            placeholder="Optional"
          />
        </label>

        <label className="ekub-field">
          <span className="site-sidebar-label">Status</span>
          <select
            name="status"
            className="form-input"
            defaultValue={EkubParticipantStatus.ACTIVE}
          >
            <option value={EkubParticipantStatus.ACTIVE}>Active</option>
            <option value={EkubParticipantStatus.INACTIVE}>Inactive</option>
          </select>
        </label>
      </div>

      <div className="toolbar" style={{ marginBottom: 0 }}>
        <button type="submit" className="submit-button">
          Add Participant
        </button>
      </div>
    </form>
  );
}
