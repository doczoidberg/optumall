import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'projectbyid'
})
export class ProjectbyidPipe implements PipeTransform {

  transform(projectid: string, ...args: unknown[]): unknown {

    var projects = args[0] as any;
    for (var i = 0; i < projects.length; i++) {
      if (projects[i].id == projectid)
        return projects[i];
    }


    return null;
  }

}
