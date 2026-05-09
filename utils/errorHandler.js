export const handleServerError = (res, error, context = "SERVER_ERROR") => {
  console.error(`\n[${context}]`);

  console.error({
    message: error.message,
    code: error.code || null,
    sqlMessage: error.sqlMessage || null,
    sql: error.sql || null,
    stack: error.stack,
  });

  return res.status(500).json({
    success: false,
    context,
    message: error.message || "Internal Server Error",
    code: error.code || null,
    sqlMessage: error.sqlMessage || null,
  });
};
