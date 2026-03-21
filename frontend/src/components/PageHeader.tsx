interface Props {
    name: string
}

export default function PageHeader({ name }: Props) {
    return (
        <div className="page-header">
            <span className="page-header-name">{name}</span>
            <span className="page-header-arrow">→</span>
            <span className="page-header-brand">The Colours of Nature</span>
        </div>
    )
}
