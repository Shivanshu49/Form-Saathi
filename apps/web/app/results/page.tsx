import { loadResults } from '../../lib/results';
import { ResultsView } from '../../lib/ResultsView';
export const dynamic = 'force-dynamic';
export default function Results() { return <ResultsView data={loadResults()} />; }
