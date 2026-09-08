/** Local heuristics only: no model request and no claim about an exit code. */
export class ErrorHintTracker {
  private output=''
  private armed=false
  private published=false
  begin():void {this.output='';this.armed=true;this.published=false}
  context():string {return this.output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'')}
  feed(chunk:string):string|undefined {
    if(!this.armed)return
    this.output=(this.output+chunk).slice(-16000)
    const text=this.output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/\r/g,'\n')
    if(this.published)return
    if(/(?:^|\n)\s*Usage:\s*grep\b/i.test(text)){this.published=true;return 'grep 显示了用法提示，可能缺少搜索词'}
    if(/(?:command not found|permission denied|no such file or directory|connection refused|syntax error|Traceback \(most recent call last\)|Job for .+ failed|fatal:|ERROR[: ]|error:)/i.test(text)){this.published=true;return '终端输出中检测到可能的错误'}
    return undefined
  }
}
