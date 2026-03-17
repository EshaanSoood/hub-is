import { RelationPicker, type RelationFieldOption } from './RelationPicker';
import { RelationRow } from './RelationRow';
import type { HubRecordDetail } from '../../services/hub/types';

interface RelationsSectionProps {
  accessToken: string;
  projectId: string;
  recordId: string;
  relationFields: RelationFieldOption[];
  outgoing: HubRecordDetail['relations']['outgoing'];
  incoming: HubRecordDetail['relations']['incoming'];
  removingRelationId: string | null;
  mutationError: string | null;
  readOnly?: boolean;
  onAddRelation: (payload: { to_record_id: string; via_field_id: string }) => Promise<void>;
  onRemoveRelation: (relationId: string) => Promise<void>;
}

export const RelationsSection = ({
  accessToken,
  projectId,
  recordId,
  relationFields,
  outgoing,
  incoming,
  removingRelationId,
  mutationError,
  readOnly = false,
  onAddRelation,
  onRemoveRelation,
}: RelationsSectionProps) => {
  const fieldLabelById = new Map(relationFields.map((field) => [field.field_id, field.name]));

  return (
    <section className="rounded-panel border border-border-muted p-3" aria-label="Relations">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-primary">Relations</h3>
        <RelationPicker
          accessToken={accessToken}
          projectId={projectId}
          fromRecordId={recordId}
          relationFields={relationFields}
          onAddRelation={onAddRelation}
          disabled={readOnly || relationFields.length === 0}
        />
      </div>

      {relationFields.length === 0 ? <p className="mt-2 text-xs text-muted">No relation fields are configured for this collection.</p> : null}
      {readOnly ? <p className="mt-2 text-xs text-muted">Read-only.</p> : null}
      {mutationError ? <p className="mt-2 text-xs text-danger">{mutationError}</p> : null}

      <div className="mt-3 space-y-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Links from this record</h4>
          {outgoing.length === 0 ? (
            <p className="mt-2 text-xs text-muted">No outgoing relations.</p>
          ) : (
            <ul className="mt-2 space-y-2" aria-label="Outgoing relations">
              {outgoing.map((relation) => (
                <RelationRow
                  key={relation.relation_id}
                  title={relation.to_record?.title || relation.to_record_id}
                  subtitle={relation.to_record?.collection_name || relation.to_record?.collection_id || null}
                  viaFieldLabel={fieldLabelById.get(relation.via_field_id) || relation.via_field_id}
                  removeLabel={`Remove relation to ${relation.to_record?.title || relation.to_record_id}`}
                  onRemove={() => {
                    if (!readOnly) {
                      void onRemoveRelation(relation.relation_id).catch(() => {
                        // Error state is handled by parent.
                      });
                    }
                  }}
                  removeDisabled={readOnly || removingRelationId === relation.relation_id}
                />
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Links to this record</h4>
          {incoming.length === 0 ? (
            <p className="mt-2 text-xs text-muted">No incoming relations.</p>
          ) : (
            <ul className="mt-2 space-y-2" aria-label="Incoming relations">
              {incoming.map((relation) => (
                <RelationRow
                  key={relation.relation_id}
                  title={relation.from_record?.title || relation.from_record_id}
                  subtitle={relation.from_record?.collection_name || relation.from_record?.collection_id || null}
                  viaFieldLabel={fieldLabelById.get(relation.via_field_id) || relation.via_field_id}
                  removeLabel={`Remove relation from ${relation.from_record?.title || relation.from_record_id}`}
                  onRemove={() => {
                    if (!readOnly) {
                      void onRemoveRelation(relation.relation_id).catch(() => {
                        // Error state is handled by parent.
                      });
                    }
                  }}
                  removeDisabled={readOnly || removingRelationId === relation.relation_id}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};
