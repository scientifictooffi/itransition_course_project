interface Tag {
  id: string;
  label: string;
  count: number;
}

interface TagCloudProps {
  tags: Tag[];
}

export const TagCloud: React.FC<TagCloudProps> = ({ tags }) => {
  const maxCount = Math.max(...tags.map((tag) => tag.count), 1);

  return (
    <section className="mt-4">
      <h2 className="h5 mb-2">Tags</h2>
      <div className="bg-white rounded-3 shadow-sm p-3">
        <div className="d-flex flex-wrap gap-2">
          {tags.map((tag) => {
            const weight = 0.8 + (tag.count / maxCount) * 0.7;
            const fontSize = `${0.8 * weight}rem`;

            return (
              <button
                key={tag.id}
                type="button"
                className="btn btn-outline-secondary btn-sm"
                style={{ fontSize }}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

