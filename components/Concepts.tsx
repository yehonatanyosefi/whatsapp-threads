type ConceptsProps = {
	concepts: string[]
}
export function Concepts({ concepts }: ConceptsProps) {
	return (
		<div className="flex flex-wrap gap-2">
			{concepts.map((concept, index) => (
				<div key={index} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
					{concept}
				</div>
			))}
		</div>
	)
}
