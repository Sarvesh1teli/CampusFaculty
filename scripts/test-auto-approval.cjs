const fs=require('fs');const p='apps/api/src/integration.test.ts';let s=fs.readFileSync(p,'utf8');s=s.replace('      // Verify CSRF and role checks explicitly.',`      await request('owner','admin/settings/teacher_auto_approve_enabled','PATCH',{value:false});
      await request('teacherPaid','profile','PATCH',{...fields,directoryVisible:true,directoryConsent:true});
      assert.equal((await request('teacherPaid','profile')).profileReviewed,true);
      await request('autoTeacher','auth/register','POST',{email:'auto@example.com',password:pass,name:'Auto Teacher',role:'CANDIDATE'},201);
      await request('autoTeacher','profile','PATCH',fields);
      assert.equal((await request('autoTeacher','profile')).profileReviewed,false);
      await request('owner','admin/settings/teacher_auto_approve_enabled','PATCH',{value:true});
      assert.equal((await request('autoTeacher','profile')).profileReviewed,true);
      await request('autoNew','auth/register','POST',{email:'autonew@example.com',password:pass,name:'Auto New',role:'CANDIDATE'},201);
      await request('autoNew','profile','PATCH',fields);
      assert.equal((await request('autoNew','profile')).profileReviewed,true);
      await request('owner','admin/settings/teacher_auto_approve_enabled','PATCH',{value:false});
      await request('autoNew','profile','PATCH',fields);
      assert.equal((await request('autoNew','profile')).profileReviewed,true);
      // Verify CSRF and role checks explicitly.`);fs.writeFileSync(p,s);for(const f of ['OPTION2_TEST_GUIDE.md','IMPLEMENTATION.md']){s=fs.readFileSync(f,'utf8').replaceAll('Profile edits invalidate the previous review.','Approval is required only once.').replaceAll('Saving profile changes requires a fresh review before anonymous directory discovery.','Initial approval is required unless auto-approval is enabled; later edits keep approval.').replaceAll('ask Super Admin to review the new revision before searching again','keep the existing approval when searching again').replaceAll('Profile edits reset the review gate','Profile edits preserve approval after initial approval');fs.writeFileSync(f,s);}
