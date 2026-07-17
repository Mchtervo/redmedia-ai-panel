# server/auth/

Oturum/kullanıcı yardımcıları için rezerve edilmiştir (örn. `getCurrentUser()`,
`requireUser()`). Şu an `src/app/dashboard/layout.tsx`, `src/app/login/page.tsx`
gibi yerlerde bu mantık ayrı ayrı yazılıdır; buraya çıkarılması ayrı bir
refactor adımıdır, mimari onayının parçası olarak henüz yapılmadı.
