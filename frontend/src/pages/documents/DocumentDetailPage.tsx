import { useParams } from "react-router-dom";

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">تفاصيل المستند</h1>
        <p className="mt-1 text-sm text-gray-500">Document #{id}</p>
      </div>

      {/* Placeholder: Document detail will be implemented in Phase 3 */}
      <div className="card p-12 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto h-12 w-12 text-gray-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-600">
          تفاصيل المستند
        </h3>
        <p className="mt-2 text-sm text-gray-400">
          سيتم عرض تفاصيل المستند رقم {id} هنا في المرحلة الثالثة
        </p>
      </div>
    </div>
  );
}
